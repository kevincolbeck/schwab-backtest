"""FastAPI service wrapping the backtest engine.

Endpoints:
    GET  /healthz
    POST /backtest        run a spec, persist the run, return stats + curve + trades
    GET  /runs/{id}       full run detail
    GET  /runs/{id}/diff/{other}   side-by-side stat blocks
    POST /chat            spec-editing chat (strict JSON contract, one self-correction retry)
    GET  /templates       template gallery specs (+ cached headline stats when built)

Env: ANTHROPIC_API_KEY, CHAT_MODEL, POLYGON_API_KEY, BACKTEST_CACHE_DB,
SERVICE_DATA_DIR, ALLOWED_ORIGINS, MAX_SYMBOLS_PER_RUN, TEMPLATES_DIR.
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator

from service import env  # noqa: F401  (loads .env before anything reads os.environ)
from service import auth
from service import chat as chat_brain
from service import backtest_runner, forward, runs_store
from ai.strategist import clamp_spec, validate_spec  # engine path set by backtest_runner

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

MAX_SYMBOLS_PER_RUN = int(os.getenv("MAX_SYMBOLS_PER_RUN", "200"))
TEMPLATES_DIR = Path(os.getenv("TEMPLATES_DIR", Path(__file__).resolve().parent.parent / "templates"))
ALLOWED_ORIGINS = [o for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o]

DISCLAIMER = chat_brain.DISCLAIMER

app = FastAPI(title="Chat-to-Backtest API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


class BacktestRequest(BaseModel):
    spec: dict
    start_date: str = "2016-01-01"
    end_date: Optional[str] = None
    starting_capital: float = Field(default=100_000.0, gt=0, le=1_000_000_000)
    slippage_pct: float = Field(default=0.05, ge=0, le=5)
    parent_run_id: Optional[str] = None

    @model_validator(mode="after")
    def _dates_ordered(self):
        if self.end_date is not None and self.start_date >= self.end_date:
            raise ValueError("start_date must be before end_date")
        return self


class DeployRequest(BaseModel):
    run_id: str
    name: Optional[str] = None
    visibility: str = Field(default="public", pattern="^(public|private)$")
    starting_capital: float = Field(default=100_000.0, gt=0, le=1_000_000_000)
    # Dev/house only: backdate the deployment (production sets this to today).
    deployed_at: Optional[str] = None


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    current_spec: Optional[dict] = None
    last_run_stats: Optional[dict] = None
    bt_summary: str = ""


def current_user(request: Request) -> Optional[dict]:
    return auth.get_user(request.headers.get("authorization"))


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@app.get("/healthz")
def healthz():
    return {"ok": True, "time": datetime.utcnow().isoformat() + "Z"}


@app.get("/me")
def me(user: Optional[dict] = Depends(current_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="not signed in")
    limits = auth.limits_for(user)
    active = [d for d in forward.list_deployments("active") if d["owner"] == user["id"]]
    return {"id": user["id"], "email": user["email"], "plan": user["plan"],
            "limits": limits, "active_deployments": len(active)}


@app.get("/me/runs")
def my_runs(user: Optional[dict] = Depends(current_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="not signed in")
    return {"runs": runs_store.list_runs_for_owner(user["id"])}


@app.get("/me/deployments")
def my_deployments(user: Optional[dict] = Depends(current_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="not signed in")
    out = []
    for dep in forward.list_deployments("active"):
        if dep["owner"] != user["id"]:
            continue
        out.append({**_public_deployment(dep), "summary": forward.forward_summary(dep)})
    return {"deployments": out}


@app.post("/backtest")
def backtest(
    req: BacktestRequest,
    request: Request,
    user: Optional[dict] = Depends(current_user),
):
    spec = clamp_spec(req.spec)
    errors = validate_spec(spec)
    if errors:
        raise HTTPException(status_code=422, detail={"validation_errors": errors})

    limits = auth.limits_for(user)
    identity = user["id"] if user else f"ip:{_client_ip(request)}"
    if not auth.check_and_count_run(identity, limits["runs_per_day"]):
        raise HTTPException(
            status_code=429,
            detail=f"daily backtest limit reached ({limits['runs_per_day']}/day)"
            + (" — sign in or upgrade for more" if user is None else " — upgrade for unlimited runs"),
        )

    symbols = spec.get("symbols", [])
    is_all_us = any(
        isinstance(s, str) and s.strip().upper() in backtest_runner.ALL_US_TOKENS
        for s in symbols
    )
    if is_all_us and not limits["all_us"]:
        raise HTTPException(
            status_code=403,
            detail="the full-US universe is a Max plan feature — pick specific symbols instead",
        )
    plan_symbol_cap = min(limits["max_symbols"], MAX_SYMBOLS_PER_RUN)
    if not is_all_us and len(symbols) > plan_symbol_cap:
        raise HTTPException(
            status_code=422,
            detail={"validation_errors": [f"too many symbols (max {plan_symbol_cap} on your plan)"]},
        )

    end_date = req.end_date or datetime.now().strftime("%Y-%m-%d")
    started = datetime.utcnow()
    results, bt_config = backtest_runner.run_backtest(
        spec=spec,
        start_date=req.start_date,
        end_date=end_date,
        starting_capital=req.starting_capital,
        slippage_pct=req.slippage_pct,
        max_symbols=MAX_SYMBOLS_PER_RUN if is_all_us else 0,
    )
    elapsed = (datetime.utcnow() - started).total_seconds()

    serialized = backtest_runner.serialize_results(results)
    if serialized.get("error"):
        raise HTTPException(status_code=422, detail={"error": serialized["error"]})

    run_id = runs_store.save_run(
        serialized, spec, bt_config, run_type="api",
        parent_run_id=req.parent_run_id, owner=user["id"] if user else None,
    )
    logger.info("Backtest %s finished in %.1fs (%s trades)",
                run_id, elapsed, (serialized["stats"] or {}).get("total_trades"))
    return {
        "run_id": run_id,
        "parent_run_id": req.parent_run_id,
        "elapsed_seconds": round(elapsed, 2),
        "spec": spec,
        "params": {
            "start_date": req.start_date,
            "end_date": end_date,
            "starting_capital": req.starting_capital,
            "slippage_pct": req.slippage_pct,
            "benchmark": bt_config.benchmark,
        },
        "stats": serialized["stats"],
        "equity_curve": serialized["equity_curve"],
        "trades": serialized["trades"],
        "disclaimer": DISCLAIMER,
    }


@app.get("/runs/{run_id}")
def get_run(run_id: str):
    run = runs_store.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")
    run["disclaimer"] = DISCLAIMER
    return run


@app.get("/runs/{run_id}/diff/{other_id}")
def diff_runs(run_id: str, other_id: str):
    diff = runs_store.diff_runs(run_id, other_id)
    if diff is None:
        raise HTTPException(status_code=404, detail="run not found")
    return diff


@app.post("/chat")
def chat(req: ChatRequest):
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="chat is not configured (ANTHROPIC_API_KEY)")

    messages = [m.model_dump() for m in req.messages if m.role in ("user", "assistant")]
    if not messages:
        raise HTTPException(status_code=422, detail="messages must contain at least one turn")

    try:
        system_prompt = chat_brain.build_system_prompt(
            req.current_spec, req.last_run_stats, req.bt_summary or "No backtest configured yet."
        )
    except Exception:
        # A malformed stats payload must degrade the context, never 500 the chat.
        logger.warning("system prompt build failed; continuing without stats", exc_info=True)
        system_prompt = chat_brain.build_system_prompt(
            req.current_spec, None, req.bt_summary or "No backtest configured yet."
        )
    try:
        raw = chat_brain.call_claude(messages, system_prompt)
    except Exception:
        logger.error("chat model call failed", exc_info=True)
        raise HTTPException(status_code=502, detail="chat model call failed")

    parsed = chat_brain.parse_chat_response(raw)

    # Server-side guardrails + one self-correction retry on an invalid spec.
    validation_errors: List[str] = []
    if parsed["updated_spec"] is not None:
        spec = clamp_spec(parsed["updated_spec"])
        errors = validate_spec(spec)
        if errors:
            retry_messages = messages + [
                {"role": "assistant", "content": raw},
                {
                    "role": "user",
                    "content": (
                        "Your updated_spec failed validation:\n- "
                        + "\n- ".join(errors)
                        + "\nReturn the corrected full JSON response (same strict format)."
                    ),
                },
            ]
            try:
                raw_retry = chat_brain.call_claude(retry_messages, system_prompt)
                reparsed = chat_brain.parse_chat_response(raw_retry)
                if reparsed["updated_spec"] is not None:
                    retry_spec = clamp_spec(reparsed["updated_spec"])
                    retry_errors = validate_spec(retry_spec)
                    if not retry_errors:
                        parsed = reparsed
                        parsed["updated_spec"] = retry_spec
                        errors = []
                    else:
                        errors = retry_errors
                        parsed = reparsed
            except Exception:
                logger.warning("chat retry failed", exc_info=True)
            if errors:
                validation_errors = errors
                parsed["updated_spec"] = None
                parsed["should_rerun"] = False
        else:
            parsed["updated_spec"] = spec

    return {
        "reply": parsed["reply"],
        "updated_spec": parsed["updated_spec"],
        "should_rerun": parsed["should_rerun"],
        "validation_errors": validation_errors,
        "disclaimer": DISCLAIMER,
    }


@app.post("/deploy")
def deploy(req: DeployRequest, user: Optional[dict] = Depends(current_user)):
    """Deploy a completed run's spec to forward testing (freezes the spec)."""
    if auth.auth_configured() and user is None:
        raise HTTPException(status_code=401, detail="sign in to deploy to the forward ledger")
    limits = auth.limits_for(user)
    if limits["deployments"] == 0:
        raise HTTPException(status_code=403, detail="your plan has no forward-test slots")
    if req.visibility == "private" and not limits["private"]:
        raise HTTPException(
            status_code=403, detail="private deployments are a Pro feature — public is free"
        )
    owner = user["id"] if user else "house"
    if user is not None:
        active = [d for d in forward.list_deployments("active") if d["owner"] == owner]
        if len(active) >= limits["deployments"]:
            raise HTTPException(
                status_code=403,
                detail=f"deployment limit reached ({limits['deployments']} on your plan) — "
                "archive one or upgrade",
            )

    run = runs_store.get_run(req.run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")
    spec = clamp_spec(run["spec"])
    errors = validate_spec(spec)
    if errors:
        raise HTTPException(status_code=422, detail={"validation_errors": errors})
    deployment = forward.create_deployment(
        spec=spec,
        name=req.name or spec.get("name"),
        owner=owner,
        visibility=req.visibility,
        starting_capital=req.starting_capital,
        deployed_at=req.deployed_at if user is None else None,  # backdating is house-only
        source_run_id=req.run_id,
        backtest_stats=run.get("stats"),
    )
    return {"deployment": _public_deployment(deployment), "disclaimer": DISCLAIMER}


class ShareRequest(BaseModel):
    run_id: str


@app.post("/share")
def create_share(req: ShareRequest, user: Optional[dict] = Depends(current_user)):
    """Mint a public share slug for a run. Free/anonymous shares carry a watermark."""
    run = runs_store.get_run(req.run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")
    plan = (user or {}).get("plan", "anon")
    slug = runs_store.create_share(req.run_id, watermarked=plan not in ("pro", "max"))
    if slug is None:
        raise HTTPException(status_code=404, detail="run not found")
    return {"share_slug": slug}


@app.get("/share/{slug}")
def get_share(slug: str):
    shared = runs_store.get_share(slug)
    if shared is None:
        raise HTTPException(status_code=404, detail="share not found")
    shared["disclaimer"] = DISCLAIMER
    return shared


def _public_deployment(dep: dict) -> dict:
    return {
        "slug": dep["slug"],
        "name": dep["name"],
        "owner": dep["owner"],
        "visibility": dep["visibility"],
        "status": dep["status"],
        "spec_hash": dep["spec_hash"],
        "starting_capital": dep["starting_capital"],
        "deployed_at": dep["deployed_at"],
    }


@app.get("/forward/{deployment_id}")
def forward_record(deployment_id: str):
    dep = forward.get_deployment(deployment_id) or forward.get_deployment_by_slug(deployment_id)
    if dep is None or dep["visibility"] != "public":
        raise HTTPException(status_code=404, detail="deployment not found")
    return {
        "deployment": _public_deployment(dep),
        "signals": forward.get_signals(dep["id"]),
        "equity": forward.get_equity_series(dep["id"]),
        "summary": forward.forward_summary(dep),
        "disclaimer": DISCLAIMER,
    }


@app.get("/strategy/{slug}")
def strategy_page(slug: str):
    """Everything the public strategy page needs: frozen spec, forward record,
    and the original backtest stats side-by-side (never merged — the
    separation IS the honesty product)."""
    dep = forward.get_deployment_by_slug(slug)
    if dep is None or dep["visibility"] != "public":
        raise HTTPException(status_code=404, detail="strategy not found")
    return {
        "deployment": _public_deployment(dep),
        "spec": dep["spec_frozen"],
        "backtest_stats": dep["backtest_stats"],
        "source_run_id": dep["source_run_id"],
        "signals": forward.get_signals(dep["id"]),
        "equity": forward.get_equity_series(dep["id"]),
        "summary": forward.forward_summary(dep),
        "execution_model": (
            "Paper trading on end-of-day data: signals are evaluated on the daily "
            "close and filled per the strategy's entry price field with the same "
            "slippage assumption as backtests. The deployed spec is frozen "
            "(hash-verified); the ledger is append-only."
        ),
        "disclaimer": DISCLAIMER,
    }


@app.get("/leaderboard")
def get_leaderboard(min_days: Optional[int] = None):
    return {
        "entries": forward.leaderboard(min_days=min_days),
        "min_days": forward.MIN_LEADERBOARD_DAYS if min_days is None else min_days,
        "disclaimer": DISCLAIMER,
    }


# ── Admin ops (remote seeding/worker runs; guarded by ADMIN_TOKEN) ───────────

def _require_admin(request: Request) -> None:
    token = os.getenv("ADMIN_TOKEN", "")
    if not token:
        raise HTTPException(status_code=404, detail="not found")  # endpoint hidden
    supplied = request.headers.get("x-admin-token", "")
    if not supplied or supplied != token:
        raise HTTPException(status_code=403, detail="bad admin token")


@app.post("/admin/seed-house")
def admin_seed_house(request: Request, deployed_at: Optional[str] = None):
    """Deploy all templates as house strategies (idempotent) + run the worker."""
    _require_admin(request)
    seeded = forward.seed_house_templates(str(TEMPLATES_DIR), deployed_at=deployed_at)
    worker = forward.run_worker()
    return {"seeded": seeded, "worker": worker, "leaderboard": forward.leaderboard(min_days=0)}


@app.post("/admin/run-worker")
def admin_run_worker(request: Request, as_of: Optional[str] = None):
    """Manual/backfill worker pass (same as the cron; idempotent)."""
    _require_admin(request)
    return forward.run_worker(as_of=as_of)


@app.get("/templates")
def templates():
    if not TEMPLATES_DIR.exists():
        return {"templates": []}
    cached_stats = {}
    stats_path = TEMPLATES_DIR / "_stats.json"
    if stats_path.exists():
        try:
            cached_stats = json.loads(stats_path.read_text(encoding="utf-8"))
        except Exception:
            logger.warning("Unreadable template stats cache", exc_info=True)

    out = []
    for path in sorted(TEMPLATES_DIR.glob("*.json")):
        if path.name.startswith("_"):
            continue
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            logger.warning("Skipping unreadable template %s", path.name, exc_info=True)
            continue
        template_id = path.stem
        out.append({
            "id": template_id,
            "meta": doc.get("meta", {}),
            "spec": doc.get("spec", doc),
            "cached_stats": cached_stats.get(template_id),
        })
    return {"templates": out, "disclaimer": DISCLAIMER}
