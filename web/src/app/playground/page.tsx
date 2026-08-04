"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CandleChart, { type Bar, type TradeMarker } from "@/components/CandleChart";
import ChatPanel from "@/components/ChatPanel";
import DiffStrip from "@/components/DiffStrip";
import EquityChart from "@/components/EquityChart";
import StatTiles from "@/components/StatTiles";
import TradeInspector from "@/components/TradeInspector";
import TradeTable from "@/components/TradeTable";
import Button, { buttonClasses } from "@/components/ui/Button";
import Tabs from "@/components/ui/Tabs";
import {
  ApiError,
  createShare,
  deployRun,
  fetchBars,
  fetchExplanation,
  fetchMe,
  fetchRun,
  fetchTemplates,
  runBacktest,
  sendChat,
} from "@/lib/api";
import { DEFAULT_START_DATE, DISCLAIMER } from "@/lib/constants";
import { diffSpecs } from "@/lib/diff";
import { englishRules } from "@/lib/englishRules";
import { pineExport } from "@/lib/exportPine";
import { download, pythonExport, slugifyName } from "@/lib/exportPython";
import { fmtDate, fmtMoney, fmtPct, fmtSignedPct } from "@/lib/format";
import { templateHero } from "@/lib/templates";
import { useAuthModal } from "@/components/AuthModal";
import { supabaseBrowser } from "@/lib/supabase/client";
import type {
  ChatTurn,
  IndicatorSeries,
  RunResult,
  Spec,
  SpecChange,
  Template,
  Trade,
} from "@/lib/types";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function runRange(run: RunResult | null): { start: string; end: string } | null {
  const p = run?.params as { start_date?: string; end_date?: string } | undefined;
  if (!p?.start_date || !p?.end_date) return null;
  return { start: String(p.start_date), end: String(p.end_date) };
}

// Scratch-mode intake (Phase D): the chat co-builds a blank spec, so the empty
// chat welcomes the user instead of assuming a template is already loaded.
const SCRATCH_INTRO =
  "Let's build your strategy from a blank page. Describe the idea in your own " +
  "words — I'll turn it into exact rules with you, step by step: market → " +
  "timeframe → entry → exits → sizing.";
const SCRATCH_SUGGESTIONS = [
  "A momentum strategy that rotates into the strongest tech stocks",
  "Buy SPY dips below its 50-day average, exit on recovery",
  "Breakouts to new 52-week highs with a trailing stop",
];
const SCRATCH_PLACEHOLDER = 'e.g. "buy oversold dips on QQQ with a 5% stop"';

function LabGate() {
  const { openAuth } = useAuthModal();
  useEffect(() => {
    openAuth("The lab is members-only. Create a free account — you get starter credits, no card required.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="card max-w-md p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          <span aria-hidden className="mr-2 inline-block h-2 w-0.5 bg-accent" />
          The Lab
        </p>
        <h1 className="mt-2 text-xl font-semibold">Sign in to start building</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Free accounts come with starter credits — enough to run strategies, chat
          with the AI, and see how the lab works. No card required.
        </p>
        <Button className="mt-6" onClick={() => openAuth()}>
          Sign in / create account
        </Button>
        <p className="mt-4 text-caption text-faint">
          Just browsing? The <Link href="/leaderboard" className="text-accent hover:underline">leaderboard</Link> and
          shared results are open to everyone.
        </p>
      </div>
    </div>
  );
}

function PlaygroundInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  // Phase D "New from scratch": no template, no spec yet — the chat runs a
  // guided intake and the first updated_spec it returns becomes the draft.
  const [scratchMode, setScratchMode] = useState(false);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState(todayISO());
  const [run, setRun] = useState<RunResult | null>(null);
  const [prevRun, setPrevRun] = useState<RunResult | null>(null);
  const [changes, setChanges] = useState<SpecChange[]>([]);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [running, setRunning] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployedSlug, setDeployedSlug] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<string>("results");

  // Trade forensics (Phase B): candle bars + spec-driven indicator series per
  // symbol, keyed by the run they belong to; the inspector and Chart tab
  // share this cache and consume indicators automatically (WS5).
  const [barsCache, setBarsCache] = useState<
    Record<string, { bars: Bar[]; indicators: IndicatorSeries[] }>
  >({});
  const [loadingSymbols, setLoadingSymbols] = useState<Record<string, true>>({});
  const [inspectTrade, setInspectTrade] = useState<Trade | null>(null);
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);
  const [aiEnglish, setAiEnglish] = useState<{ forSpec: Spec; text: string } | null>(null);
  const [aiEnglishLoading, setAiEnglishLoading] = useState(false);

  const loadBars = useCallback(
    async (runId: string, symbol: string) => {
      if (barsCache[symbol] || loadingSymbols[symbol]) return;
      setLoadingSymbols((s) => ({ ...s, [symbol]: true }));
      try {
        const out = await fetchBars(runId, symbol);
        // Bars belong to a specific run — drop responses that arrive after a
        // rerun or template switch replaced the run they were fetched for.
        if (runRef.current?.run_id !== runId) return;
        setBarsCache((cache) => ({
          ...cache,
          // indicators may be absent on older cached payloads — degrade to [].
          [symbol]: { bars: out.bars, indicators: out.indicators ?? [] },
        }));
      } catch {
        if (runRef.current?.run_id === runId) {
          setBarsCache((cache) => ({ ...cache, [symbol]: { bars: [], indicators: [] } }));
        }
      } finally {
        setLoadingSymbols((s) => {
          const next = { ...s };
          delete next[symbol];
          return next;
        });
      }
    },
    [barsCache, loadingSymbols],
  );

  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    if (!supabase) {
      setSignedIn(null);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      const authed = Boolean(data.session);
      setSignedIn(authed);
      if (authed) {
        fetchMe()
          .then((me) => setCreditBalance(me.credits))
          .catch(() => {});
      }
    });
  }, []);

  // Latest run without stale-closure risk (chat rerun can race a manual run),
  // and a generation counter so template switches invalidate in-flight work.
  const runRef = useRef<RunResult | null>(null);
  const genRef = useRef(0);
  // The ?template= value consumed by entering scratch mode — the palette-jump
  // effect must ignore it until the URL clear commits (see onStartScratch).
  const staleTemplateParam = useRef<string | null>(null);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const busy = running || chatBusy;
  const dateError =
    startDate >= endDate ? "Start date must be before the end date." : null;
  // Set when switching to an intraday timeframe auto-clamped the start date.
  const [intradayHint, setIntradayHint] = useState(false);

  // Load templates + apply ?template= / ?run= once.
  useEffect(() => {
    let cancelled = false;
    const gen = genRef.current;
    (async () => {
      try {
        const { templates: list } = await fetchTemplates();
        if (cancelled) return;
        setTemplates(list);
        // The rail always needs the list, but the default selection must not
        // stomp a session the user already started (e.g. scratch mode).
        if (genRef.current !== gen) return;
        const runParam = searchParams.get("run");
        if (runParam) {
          try {
            const loaded = await fetchRun(runParam);
            if (cancelled || genRef.current !== gen) return;
            setSpec(loaded.spec);
            setRun(loaded);
            const range = runRange(loaded);
            if (range) {
              setStartDate(range.start);
              setEndDate(range.end);
            }
            setTemplateId("");
            return;
          } catch {
            /* fall through to template */
          }
        }
        const wanted = searchParams.get("template");
        const pick =
          list.find((t) => t.id === wanted) ??
          list.find((t) => t.id === "golden-cross") ??
          list[0];
        if (pick) {
          setTemplateId(pick.id);
          setSpec(pick.spec);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load templates");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⌘K template jumps while already on /playground only change the query
  // string (no remount), so apply ?template= whenever it changes post-mount.
  const wantedTemplate = searchParams.get("template");
  useEffect(() => {
    if (!wantedTemplate) {
      staleTemplateParam.current = null; // URL is clean again
      return;
    }
    if (templates.length === 0) return;
    if (wantedTemplate === templateId) return;
    // Entering scratch mode consumed this param (its URL clear may still be
    // in flight) — only a NEW param value may pull us out of scratch mode.
    if (wantedTemplate === staleTemplateParam.current) return;
    if (templates.some((t) => t.id === wantedTemplate)) {
      onSelectTemplate(wantedTemplate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedTemplate, templates]);

  const btSummary = useMemo(() => {
    if (!spec) return "No backtest configured yet.";
    const range = runRange(run);
    const capital = run?.stats?.starting_capital ?? 100000;
    return [
      `Date range: ${range?.start ?? startDate} to ${range?.end ?? endDate}`,
      `Starting capital: ${fmtMoney(Number(capital))}`,
      `Strategy: '${spec.name}'`,
      `Benchmark: SPY`,
      `Slippage: 0.05%`,
    ].join("\n");
  }, [spec, startDate, endDate, run]);

  const executeRun = useCallback(
    async (specToRun: Spec, specChanges: SpecChange[] = []) => {
      const gen = genRef.current;
      setRunning(true);
      setError(null);
      try {
        const latest = runRef.current;
        const result = await runBacktest({
          spec: specToRun,
          start_date: startDate,
          end_date: endDate,
          parent_run_id: latest?.run_id ?? null,
        });
        if (genRef.current !== gen) return null; // template switched mid-flight
        const previous = runRef.current;
        setPrevRun(previous);
        setRun(result);
        setDeployedSlug(null);
        setActiveTab("results");
        setBarsCache({}); // bars belong to a specific run
        setInspectTrade(null);
        setChartSymbol(null);
        if (typeof result.credits_remaining === "number") {
          setCreditBalance(result.credits_remaining);
        }
        // Flag apples-to-oranges: if the date window or bar timeframe changed
        // between runs, suppress numeric comparisons and say so instead.
        const pseudoChanges: SpecChange[] = [];
        const prevRange = runRange(previous);
        const newRange = runRange(result);
        if (previous && prevRange && newRange &&
            (prevRange.start !== newRange.start || prevRange.end !== newRange.end)) {
          pseudoChanges.push({
            field: "date range",
            from: `${prevRange.start} → ${prevRange.end}`,
            to: `${newRange.start} → ${newRange.end}`,
          });
        }
        const prevTf = previous?.spec.backtest_timeframe ?? "1d";
        const newTf = result.spec.backtest_timeframe ?? "1d";
        if (previous && prevTf !== newTf &&
            // chat-driven timeframe edits already get a pill from diffSpecs
            !specChanges.some((c) => c.field === "backtest timeframe")) {
          pseudoChanges.push({ field: "timeframe", from: prevTf, to: newTf });
        }
        setChanges([...specChanges, ...pseudoChanges]);
        return result;
      } catch (e) {
        if (genRef.current === gen) {
          // Out-of-credits responses carry the authoritative balance — sync
          // the meter so it doesn't keep showing stale credits.
          if (e instanceof ApiError && e.status === 402 && typeof e.detail?.balance === "number") {
            setCreditBalance(e.detail.balance);
          }
          setError(e instanceof Error ? e.message : "Backtest failed");
        }
        return null;
      } finally {
        if (genRef.current === gen) setRunning(false);
      }
    },
    [startDate, endDate],
  );

  // Runs over different date windows or bar timeframes aren't comparable —
  // used to suppress before/after deltas and the ghost equity curve.
  const notComparable = useMemo(() => {
    const a = runRange(prevRun);
    const b = runRange(run);
    if (a && b && (a.start !== b.start || a.end !== b.end)) return true;
    return Boolean(
      prevRun && run &&
        (prevRun.spec.backtest_timeframe ?? "1d") !== (run.spec.backtest_timeframe ?? "1d"),
    );
  }, [prevRun, run]);

  const onSelectTemplate = (id: string) => {
    if (id === templateId) return; // re-clicking the active template must not wipe the session
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    genRef.current += 1; // invalidate anything in flight
    setScratchMode(false);
    setTemplateId(id);
    setSpec(t.spec);
    setPrevRun(null);
    setRun(null);
    runRef.current = null;
    setChanges([]);
    setMessages([]);
    setError(null);
    setRunning(false);
    setChatBusy(false);
    setDeployedSlug(null);
    setActiveTab("results");
    setBarsCache({});
    setInspectTrade(null);
    setChartSymbol(null);
    setAiEnglish(null);
    setAiEnglishLoading(false);
    setIntradayHint(false);
  };

  // Phase D "New from scratch": same session reset as a template switch, but
  // with NO spec — the chat intake builds the first draft. Clicking it again
  // deliberately starts another blank strategy.
  const onStartScratch = () => {
    genRef.current += 1; // invalidate anything in flight
    // A ?template= (or ?run=) left in the URL must not yank us back out of
    // scratch mode via the palette-jump effect: remember the param as
    // consumed, then clear the query string.
    staleTemplateParam.current = searchParams.get("template");
    if (searchParams.toString()) router.replace("/playground", { scroll: false });
    setScratchMode(true);
    setTemplateId("");
    setSpec(null);
    setPrevRun(null);
    setRun(null);
    runRef.current = null;
    setChanges([]);
    setMessages([]);
    setError(null);
    setRunning(false);
    setChatBusy(false);
    setDeployedSlug(null);
    setActiveTab("results");
    setBarsCache({});
    setInspectTrade(null);
    setChartSymbol(null);
    setAiEnglish(null);
    setAiEnglishLoading(false);
    setIntradayHint(false);
  };

  // Intraday history is capped at ~60 days — the default multi-year window
  // would 422 immediately, so clamp the start date when leaving 1d. Switching
  // back to 1d does NOT restore the old range (keep it simple/predictable).
  const onTimeframeChange = (tf: string) => {
    if (!spec) return;
    setSpec({ ...spec, backtest_timeframe: tf });
    if (tf === "1d") {
      setIntradayHint(false);
      return;
    }
    const endMs = new Date(`${endDate}T00:00:00Z`).getTime();
    const startMs = new Date(`${startDate}T00:00:00Z`).getTime();
    if ((endMs - startMs) / 86_400_000 > 60) {
      setStartDate(new Date(endMs - 59 * 86_400_000).toISOString().slice(0, 10));
      setIntradayHint(true);
    }
  };

  const onChatSend = async (text: string) => {
    if ((!spec && !scratchMode) || busy) return;
    const gen = genRef.current;
    const nextMessages: ChatTurn[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setChatBusy(true);
    setError(null);
    try {
      const res = await sendChat({
        messages: nextMessages,
        current_spec: spec,
        last_run_stats: (runRef.current?.stats as Record<string, unknown>) ?? null,
        bt_summary: btSummary,
      });
      if (genRef.current !== gen) return; // template switched while thinking
      if (typeof res.credits_remaining === "number") {
        setCreditBalance(res.credits_remaining);
      }
      let reply = res.reply;
      if (res.validation_errors.length) {
        reply += `\n\n(The proposed change didn't pass validation: ${res.validation_errors.join("; ")})`;
      }
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
      if (res.updated_spec) {
        // The first scratch-mode draft has no baseline to diff against.
        const specChanges = spec ? diffSpecs(spec, res.updated_spec) : [];
        setSpec(res.updated_spec);
        if (res.should_rerun) {
          await executeRun(res.updated_spec, specChanges);
        } else {
          setChanges(specChanges);
        }
      }
    } catch (e) {
      if (genRef.current === gen) {
        // Out-of-credits responses carry the authoritative balance — sync
        // the meter so it doesn't keep showing stale credits.
        if (e instanceof ApiError && e.status === 402 && typeof e.detail?.balance === "number") {
          setCreditBalance(e.detail.balance);
        }
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: `Something went wrong: ${e instanceof Error ? e.message : "unknown error"}`,
          },
        ]);
      }
    } finally {
      if (genRef.current === gen) setChatBusy(false);
    }
  };

  const copyRunLink = async () => {
    if (!run?.run_id) return;
    try {
      const { share_slug } = await createShare(run.run_id);
      await navigator.clipboard.writeText(`${window.location.origin}/s/${share_slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/runs/${run.run_id}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* ignore */
      }
    }
  };

  const onDeploy = async () => {
    if (!run?.run_id || deploying) return;
    setDeploying(true);
    setError(null);
    try {
      const out = await deployRun({ run_id: run.run_id, name: run.spec.name });
      setDeployedSlug(out.deployment.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deploy failed");
    } finally {
      setDeploying(false);
    }
  };

  const headerRange = runRange(run);
  const rules = spec ? englishRules(spec) : null;

  // Deploy disclosure: intraday deploys carry a one-time fee (Pro/Max), and
  // 1m/5m strategies can't be forward-deployed yet (docs/pricing-model.md).
  const deployTimeframe = (run?.spec.backtest_timeframe ?? "1d").trim() || "1d";
  const intradayDeploy = ["15m", "30m", "60m", "1m", "5m"].includes(deployTimeframe);
  // 1m/5m are the premium data class — deployable day one at a higher fee.
  const deployFee = ["1m", "5m"].includes(deployTimeframe) ? 250 : 100;

  const tradedSymbols = useMemo(() => {
    if (!run) return [];
    return Array.from(new Set(run.trades.map((t) => t.symbol)));
  }, [run]);
  const activeChartSymbol =
    chartSymbol && tradedSymbols.includes(chartSymbol)
      ? chartSymbol
      : tradedSymbols[0] ?? null;

  const chartMarkers: TradeMarker[] = useMemo(() => {
    if (!run || !activeChartSymbol) return [];
    return run.trades
      .filter((t) => t.symbol === activeChartSymbol)
      .flatMap((t) => [
        { time: fmtDate(t.entry_date), kind: "entry" as const, label: "" },
        { time: fmtDate(t.exit_date), kind: "exit" as const, label: "" },
      ]);
  }, [run, activeChartSymbol]);

  // Lazy-load bars when the Chart tab needs them.
  useEffect(() => {
    if (activeTab === "chart" && run?.run_id && activeChartSymbol && !barsCache[activeChartSymbol]) {
      loadBars(run.run_id, activeChartSymbol);
    }
  }, [activeTab, run, activeChartSymbol, barsCache, loadBars]);

  // Lazy-fetch the AI-polished English once per spec when Rules opens.
  useEffect(() => {
    if (activeTab !== "rules" || !spec) return;
    if (aiEnglishLoading || (aiEnglish && aiEnglish.forSpec === spec)) return;
    let cancelled = false;
    setAiEnglishLoading(true);
    fetchExplanation(spec)
      .then((out) => {
        if (!cancelled) setAiEnglish({ forSpec: spec, text: out.english });
      })
      .catch(() => {
        /* deterministic rules remain the fallback */
      })
      .finally(() => {
        // Unconditional: a superseded fetch must never wedge loading=true
        // (the cancelled guard applies only to the data write above).
        setAiEnglishLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, spec]);

  const onInspect = (trade: Trade) => {
    setInspectTrade(trade);
    if (run?.run_id) loadBars(run.run_id, trade.symbol);
  };

  // Members-only lab (V2): gate renders only once we KNOW the visitor is
  // signed out. Placed after every hook — no conditional-hook hazards.
  if (signedIn === false) {
    return <LabGate />;
  }

  const downloadSpec = () => {
    if (!spec) return;
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(spec.name || "strategy").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Pine export is deterministic and cheap (pure string work), so computing it
  // per render keeps the warnings note in sync with the live spec draft
  // without another hook before the auth gate.
  const pineOut = spec ? pineExport(spec) : null;

  // The Rules tab renders both after a run and pre-run (scratch/template
  // drafts): it always reflects the live spec draft, while the raw spec block
  // prefers the as-run spec once a run exists.
  const rulesPanel =
    spec && rules ? (
      <div
        role="tabpanel"
        id="lab-tabs-panel-rules"
        aria-labelledby="lab-tabs-rules"
        className="space-y-3"
      >
        <div className="card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Rules in plain English</h2>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  spec &&
                  download(
                    `${slugifyName(spec.name)}.py`,
                    pythonExport(spec),
                    "text/x-python",
                  )
                }
                title="A runnable Python file with your rules and the spec embedded"
              >
                ↓ Python
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  pineOut &&
                  spec &&
                  download(`${slugifyName(spec.name)}.pine`, pineOut.code)
                }
                title="A Pine Script v6 strategy — run the same rules on TradingView"
              >
                ↓ Pine Script (.pine)
              </Button>
              <Button size="sm" variant="outline" onClick={downloadSpec}>
                ↓ Spec JSON
              </Button>
            </div>
          </div>
          {pineOut && pineOut.warnings.length > 0 && (
            <p className="mb-4 rounded-(--radius-card) border border-hairline bg-panel-2 px-4 py-3 text-caption leading-relaxed text-muted">
              Pine export: {pineOut.warnings.length} part
              {pineOut.warnings.length === 1 ? "" : "s"} of this strategy need
              manual attention on TradingView (marked{" "}
              <span className="font-mono">{"// TODO"}</span> in the file):{" "}
              {pineOut.warnings.join("; ")}. TradingView results will differ —
              different fill models and data.
            </p>
          )}
          {aiEnglishLoading && (
            <p role="status" className="mb-4 rounded-(--radius-card) border border-hairline bg-panel-2 px-4 py-3 text-sm text-muted">
              Writing the plain-English version…
            </p>
          )}
          {aiEnglish && aiEnglish.forSpec === spec && (
            <div className="mb-4 whitespace-pre-wrap rounded-(--radius-card) border border-hairline bg-accent-soft px-4 py-3 text-sm leading-relaxed">
              {aiEnglish.text}
            </div>
          )}
          <dl className="space-y-4 text-sm leading-relaxed">
            <div>
              <dt className="text-caption uppercase tracking-wide text-faint">Universe</dt>
              <dd className="mt-1">{rules.universe}</dd>
            </div>
            <div>
              <dt className="text-caption uppercase tracking-wide text-faint">Entry</dt>
              <dd className="mt-1 space-y-1">
                {rules.entry.map((s) => (
                  <p key={s}>{s}</p>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-caption uppercase tracking-wide text-faint">Exits</dt>
              <dd className="mt-1 space-y-1">
                {rules.exits.map((s) => (
                  <p key={s}>{s}</p>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-caption uppercase tracking-wide text-faint">Sizing</dt>
              <dd className="mt-1">{rules.sizing}</dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-hairline pt-3 text-caption leading-relaxed text-faint">
            Written so you could trade it by hand. Simulated results include a
            slippage assumption; manual execution will differ.
          </p>
        </div>
        <details className="card px-5 py-4">
          <summary className="focus-ring cursor-pointer rounded-(--radius-tag) text-sm font-medium">
            The spec (exact rules, no black box)
          </summary>
          <pre className="tnum slim-scroll mt-3 overflow-x-auto rounded-(--radius-card) border border-hairline bg-background p-4 text-xs leading-relaxed">
            {JSON.stringify(run?.spec ?? spec, null, 2)}
          </pre>
        </details>
      </div>
    ) : null;

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="sr-only">The Lab — backtesting playground</h1>

      {/* Lab toolbar */}
      <header className="glass sticky top-(--nav-h) z-30 border-b border-hairline">
        <div className="flex flex-wrap items-center gap-2.5 px-4 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              {spec?.name ?? (scratchMode ? "New strategy" : "The Lab")}
            </p>
            <p className="font-mono text-caption uppercase tracking-widest text-faint">
              {scratchMode
                ? "from scratch"
                : templateId
                  ? "template"
                  : run
                    ? "loaded run"
                    : "strategy"}
            </p>
          </div>

          {/* mobile-only template select (rail is hidden there) */}
          <select
            value={scratchMode ? "__scratch__" : templateId}
            onChange={(e) =>
              e.target.value === "__scratch__"
                ? onStartScratch()
                : onSelectTemplate(e.target.value)
            }
            disabled={busy}
            aria-label="Strategy template"
            className="focus-ring rounded-(--radius-control) border border-hairline bg-panel px-2.5 py-1.5 text-sm md:hidden"
          >
            {templateId === "" && !scratchMode && <option value="">Loaded run</option>}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.meta.display_name}
              </option>
            ))}
            <option value="__scratch__">+ New from scratch</option>
          </select>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setIntradayHint(false); // user took over the range
                }}
                aria-label="Backtest start date"
                className="focus-ring rounded-(--radius-control) border border-hairline bg-panel px-2 py-1.5 text-xs text-ink focus:border-accent"
              />
              →
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={todayISO()}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label="Backtest end date"
                className="focus-ring rounded-(--radius-control) border border-hairline bg-panel px-2 py-1.5 text-xs text-ink focus:border-accent"
              />
            </div>
            <select
              value={spec?.backtest_timeframe ?? "1d"}
              onChange={(e) => onTimeframeChange(e.target.value)}
              disabled={!spec || busy}
              aria-label="Bar timeframe"
              title="Bar size. Intraday timeframes are limited to ~60 days of history."
              className="focus-ring tnum hidden rounded-(--radius-control) border border-hairline bg-panel px-2 py-1.5 text-xs text-ink focus:border-accent sm:block"
            >
              <option value="1d">1D</option>
              <option value="60m">60m</option>
              <option value="30m">30m</option>
              <option value="15m">15m</option>
              <option value="5m">5m</option>
              <option value="1m">1m</option>
            </select>
            {signedIn && creditBalance !== null && (
              <Link
                href="/pricing"
                title="Your credit balance — runs and chat messages spend credits"
                className="focus-ring tnum hidden items-center gap-1 rounded-(--radius-control) border border-hairline bg-panel px-2.5 py-1.5 text-xs sm:flex"
              >
                <span className="text-accent" aria-hidden="true">◈</span>
                <span className={creditBalance < 25 ? "text-loss" : "text-ink"}>
                  {creditBalance}
                </span>
              </Link>
            )}
            <Button
              onClick={() => spec && executeRun(spec, [])}
              disabled={!spec || busy || Boolean(dateError)}
            >
              {running ? "Running…" : "Run backtest"}
            </Button>
            {run?.elapsed_seconds !== undefined && !running && (
              <span className="tnum text-xs text-faint">{run.elapsed_seconds}s</span>
            )}
            {signedIn !== null && (
              <Link
                href={signedIn ? "/dashboard" : "/login"}
                className={buttonClasses("secondary", "sm")}
              >
                {signedIn ? "Dashboard" : "Log in"}
              </Link>
            )}
          </div>
        </div>
        {dateError && (
          <p role="alert" className="border-t border-hairline px-4 py-1.5 text-xs text-loss">
            {dateError}
          </p>
        )}
        {intradayHint && !dateError && (
          <p role="status" className="border-t border-hairline px-4 py-1.5 text-xs text-muted">
            Intraday history is capped at ~60 days — start date adjusted.
          </p>
        )}
      </header>

      {error && (
        <div role="alert" className="border-b border-hairline bg-loss-soft px-4 py-2 text-sm text-loss">
          {error}
        </div>
      )}

      {/* Three-zone terminal */}
      <main className="flex flex-1 gap-3 p-3">
        {/* Left rail — strategy browser */}
        <aside className="slim-scroll hidden w-56 shrink-0 overflow-y-auto md:block lg:w-64">
          <p className="px-2 pb-2 pt-1 font-mono text-caption uppercase tracking-widest text-faint">
            Templates
          </p>
          <div className="space-y-1">
            {templates.map((t) => {
              const active = t.id === templateId;
              /* Same hero rule as TemplateCard: never annualize a sub-year
                 window — the rail must agree with the card that linked here. */
              const hero = templateHero(t);
              return (
                <button
                  key={t.id}
                  onClick={() => onSelectTemplate(t.id)}
                  disabled={busy}
                  aria-pressed={active}
                  className={`focus-ring w-full rounded-(--radius-control) border px-3 py-2.5 text-left transition-colors duration-(--dur-micro) disabled:opacity-50 ${
                    active
                      ? "border-accent bg-accent-soft"
                      : "border-transparent hover:border-hairline hover:bg-panel"
                  }`}
                >
                  <p className="truncate text-sm font-medium">
                    {active && (
                      <span aria-hidden="true" className="mr-2 inline-block h-2 w-0.5 bg-accent" />
                    )}
                    {t.meta.display_name}
                  </p>
                  <p className="mt-0.5 flex items-center justify-between text-caption text-faint">
                    <span className="uppercase tracking-wide">{t.meta.category}</span>
                    {hero && (
                      <span className="tnum">
                        {hero.kind === "cagr"
                          ? `${fmtPct(hero.value, 1)} cagr`
                          : `${fmtSignedPct(hero.value, 1)} total`}
                      </span>
                    )}
                  </p>
                </button>
              );
            })}
          </div>
          <button
            onClick={onStartScratch}
            disabled={busy}
            aria-pressed={scratchMode}
            title="Blank strategy — describe your rules and the AI builds the spec with you"
            className={`focus-ring mt-3 w-full rounded-(--radius-control) border border-dashed px-3 py-2.5 text-left transition-colors duration-(--dur-micro) disabled:opacity-50 ${
              scratchMode
                ? "border-accent bg-accent-soft"
                : "border-hairline hover:border-hairline-strong hover:bg-panel"
            }`}
          >
            <p className="truncate text-sm font-medium">
              {scratchMode && (
                <span aria-hidden="true" className="mr-2 inline-block h-2 w-0.5 bg-accent" />
              )}
              + New from scratch
            </p>
            <p className="mt-0.5 text-caption uppercase tracking-wide text-faint">
              AI-guided intake
            </p>
          </button>
        </aside>

        {/* Center workspace */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Tabs
              baseId="lab-tabs"
              tabs={[
                { id: "results", label: "Results" },
                { id: "trades", label: "Trades", badge: run?.trades.length ?? undefined },
                { id: "chart", label: "Chart" },
                { id: "rules", label: "Rules" },
              ]}
              active={activeTab}
              onChange={setActiveTab}
            />
            {run?.run_id && (
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/runs/${run.run_id}`}
                  className="focus-ring rounded-(--radius-tag) text-xs text-accent hover:underline"
                >
                  Run <span className="tnum">{run.run_id.slice(-6)}</span>
                </Link>
                <Button size="sm" variant="ghost" onClick={copyRunLink}>
                  {copied ? "Copied!" : "Share"}
                </Button>
                {deployedSlug ? (
                  <Link
                    href={`/strategy/${deployedSlug}`}
                    className="focus-ring rounded-(--radius-control) border border-accent bg-accent-soft px-2.5 py-1 text-xs text-accent transition-colors duration-(--dur-micro) hover:text-accent-hover"
                  >
                    On the ledger →
                  </Link>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onDeploy}
                      disabled={deploying || busy}
                      title="Freeze this strategy and track it on the public forward-test ledger"
                    >
                      {deploying ? "Deploying…" : "Deploy to forward test"}
                    </Button>
                    {intradayDeploy && (
                      <span
                        className="text-caption text-faint"
                        title="Intraday forward tests are evaluated on your strategy's own closed candles — one-time credit fee, Pro/Max plans"
                      >
                        Intraday deployment — Pro/Max · {deployFee} credits
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Chat change-pills render regardless of run state or active tab. */}
          {changes.length > 0 && <DiffStrip changes={changes} />}

          {run ? (
            <>
              {activeTab === "results" && (
                <div
                  role="tabpanel"
                  id="lab-tabs-panel-results"
                  aria-labelledby="lab-tabs-results"
                  className="space-y-3"
                >
                  <StatTiles
                    stats={run.stats}
                    prevStats={notComparable ? null : prevRun?.stats ?? null}
                  />
                  {notComparable && (
                    <p className="text-caption text-faint">
                      Date range or timeframe changed between runs — before/after
                      comparison hidden (the runs aren&apos;t comparable).
                    </p>
                  )}
                  <div className="card p-3">
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-sm font-medium">Equity curve</h2>
                      <span className="tnum text-xs text-faint">
                        {fmtMoney(Number(run.stats.starting_capital ?? 100000))} start ·{" "}
                        {(headerRange?.start ?? startDate).slice(0, 4)}–
                        {(headerRange?.end ?? endDate).slice(0, 4)}
                      </span>
                    </div>
                    <EquityChart
                      curve={run.equity_curve}
                      prevCurve={notComparable ? null : prevRun?.equity_curve ?? null}
                    />
                  </div>
                  <p className="text-caption text-faint">{run.disclaimer ?? DISCLAIMER}</p>
                </div>
              )}

              {activeTab === "trades" && (
                <div
                  role="tabpanel"
                  id="lab-tabs-panel-trades"
                  aria-labelledby="lab-tabs-trades"
                  className="space-y-2"
                >
                  <TradeTable trades={run.trades} onInspect={onInspect} />
                  <p className="text-caption text-faint">
                    Click any trade to see its exact entry and exit candles on the chart.
                  </p>
                </div>
              )}

              {activeTab === "chart" && (
                <div
                  role="tabpanel"
                  id="lab-tabs-panel-chart"
                  aria-labelledby="lab-tabs-chart"
                  className="space-y-3"
                >
                  {tradedSymbols.length ? (
                    <>
                      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Chart symbol">
                        {tradedSymbols.map((sym) => (
                          <button
                            key={sym}
                            onClick={() => setChartSymbol(sym)}
                            aria-pressed={sym === activeChartSymbol}
                            className={`focus-ring tnum rounded-(--radius-pill) border px-3 py-1 text-xs transition-colors duration-(--dur-micro) ${
                              sym === activeChartSymbol
                                ? "border-accent bg-accent-soft text-ink"
                                : "border-hairline text-muted hover:text-ink"
                            }`}
                          >
                            {sym === activeChartSymbol && (
                              <span
                                aria-hidden="true"
                                className="mr-1.5 inline-block h-1.5 w-1.5 rounded-(--radius-pill) bg-accent"
                              />
                            )}
                            {sym}
                          </button>
                        ))}
                      </div>
                      <div className="card p-3">
                        {activeChartSymbol && barsCache[activeChartSymbol]?.bars.length ? (
                          <CandleChart
                            bars={barsCache[activeChartSymbol].bars}
                            markers={chartMarkers}
                            indicators={barsCache[activeChartSymbol].indicators}
                            height={420}
                          />
                        ) : (
                          <div className="flex h-64 items-center justify-center text-sm text-muted" role="status">
                            {activeChartSymbol && loadingSymbols[activeChartSymbol]
                              ? "Loading candles…"
                              : "No price data for this symbol."}
                          </div>
                        )}
                      </div>
                      <p className="text-caption text-faint">
                        ▲ entries · ▼ exits for {activeChartSymbol}. Click a row in the
                        Trades tab to zoom into a single trade.
                      </p>
                    </>
                  ) : (
                    <div className="card flex min-h-48 items-center justify-center border-dashed">
                      <p className="text-sm text-muted">No trades to chart in this run.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "rules" && rulesPanel}
            </>
          ) : activeTab === "rules" && rulesPanel ? (
            // Pre-run drafts (scratch or template) still get the live Rules view.
            rulesPanel
          ) : scratchMode ? (
            <div className="card flex min-h-96 items-center justify-center border-dashed">
              <div className="max-w-sm text-center">
                {spec ? (
                  <>
                    <p className="text-sm text-muted">
                      Draft in progress — keep refining in chat, then hit{" "}
                      <span className="font-medium text-ink">Run backtest</span> to
                      see results.
                    </p>
                    <p className="mt-2 text-xs text-faint">
                      The Rules tab shows the live draft in plain English.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-mono text-xs uppercase tracking-widest text-muted">
                      <span aria-hidden className="mr-2 inline-block h-2 w-0.5 bg-accent" />
                      New from scratch
                    </p>
                    <p className="mt-2 text-sm text-muted">
                      Describe your idea in the chat — the AI will build it with
                      you: market → timeframe → entry → exits → sizing.
                    </p>
                    <p className="mt-2 text-xs text-faint">
                      A live draft appears here as soon as the first rule lands.
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="card flex min-h-96 items-center justify-center border-dashed">
              <div className="max-w-sm text-center">
                <p className="text-sm text-muted">
                  Pick a template on the left and hit{" "}
                  <span className="font-medium text-ink">Run backtest</span> — or ask the
                  AI to change anything first.
                </p>
                <p className="mt-2 text-xs text-faint">
                  Ten years of daily data, usually under ten seconds.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right dock — AI chat */}
        <div className="hidden h-[calc(100vh_-_var(--nav-h)_-_5.75rem)] w-85 shrink-0 lg:sticky lg:top-[calc(var(--nav-h)_+_3.5rem)] lg:block xl:w-95">
          <ChatPanel
            messages={messages}
            busy={chatBusy}
            onSend={onChatSend}
            disabled={(!spec && !scratchMode) || running}
            intro={scratchMode ? SCRATCH_INTRO : undefined}
            suggestions={scratchMode ? SCRATCH_SUGGESTIONS : undefined}
            placeholder={scratchMode && !spec ? SCRATCH_PLACEHOLDER : undefined}
          />
        </div>
      </main>

      {/* Chat on small screens (below workspace) */}
      <div className="h-105 p-3 pt-0 lg:hidden">
        <ChatPanel
          messages={messages}
          busy={chatBusy}
          onSend={onChatSend}
          disabled={(!spec && !scratchMode) || running}
          intro={scratchMode ? SCRATCH_INTRO : undefined}
          suggestions={scratchMode ? SCRATCH_SUGGESTIONS : undefined}
          placeholder={scratchMode && !spec ? SCRATCH_PLACEHOLDER : undefined}
        />
      </div>

      {inspectTrade && (
        <TradeInspector
          trade={inspectTrade}
          bars={barsCache[inspectTrade.symbol]?.bars ?? null}
          indicators={barsCache[inspectTrade.symbol]?.indicators ?? null}
          loading={Boolean(loadingSymbols[inspectTrade.symbol]) && !barsCache[inspectTrade.symbol]}
          onClose={() => setInspectTrade(null)}
        />
      )}
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <Suspense
      fallback={<div className="p-8 text-sm text-muted">Loading the lab…</div>}
    >
      <PlaygroundInner />
    </Suspense>
  );
}
