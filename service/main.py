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

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from service import chat as chat_brain
from service import backtest_runner, runs_store
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


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    current_spec: Optional[dict] = None
    last_run_stats: Optional[dict] = None
    bt_summary: str = ""


@app.get("/healthz")
def healthz():
    return {"ok": True, "time": datetime.utcnow().isoformat() + "Z"}


@app.post("/backtest")
def backtest(req: BacktestRequest):
    spec = clamp_spec(req.spec)
    errors = validate_spec(spec)
    if errors:
        raise HTTPException(status_code=422, detail={"validation_errors": errors})

    symbols = spec.get("symbols", [])
    is_all_us = any(
        isinstance(s, str) and s.strip().upper() in backtest_runner.ALL_US_TOKENS
        for s in symbols
    )
    if not is_all_us and len(symbols) > MAX_SYMBOLS_PER_RUN:
        raise HTTPException(
            status_code=422,
            detail={"validation_errors": [f"too many symbols (max {MAX_SYMBOLS_PER_RUN})"]},
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
        serialized, spec, bt_config, run_type="api", parent_run_id=req.parent_run_id
    )
    logger.info("Backtest %s finished in %.1fs (%s trades)",
                run_id, elapsed, (serialized["stats"] or {}).get("total_trades"))
    return {
        "run_id": run_id,
        "parent_run_id": req.parent_run_id,
        "elapsed_seconds": round(elapsed, 2),
        "spec": spec,
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

    system_prompt = chat_brain.build_system_prompt(
        req.current_spec, req.last_run_stats, req.bt_summary or "No backtest configured yet."
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
