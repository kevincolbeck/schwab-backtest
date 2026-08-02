"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ChatPanel from "@/components/ChatPanel";
import DiffStrip from "@/components/DiffStrip";
import EquityChart from "@/components/EquityChart";
import StatTiles from "@/components/StatTiles";
import TradeTable from "@/components/TradeTable";
import { deployRun, fetchRun, fetchTemplates, runBacktest, sendChat } from "@/lib/api";
import { DEFAULT_START_DATE, DISCLAIMER } from "@/lib/constants";
import { diffSpecs } from "@/lib/diff";
import { fmtMoney } from "@/lib/format";
import type { ChatTurn, RunResult, Spec, SpecChange, Template } from "@/lib/types";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function runRange(run: RunResult | null): { start: string; end: string } | null {
  const p = run?.params as { start_date?: string; end_date?: string } | undefined;
  if (!p?.start_date || !p?.end_date) return null;
  return { start: String(p.start_date), end: String(p.end_date) };
}

function PlaygroundInner() {
  const searchParams = useSearchParams();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
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

  // Latest run without stale-closure risk (chat rerun can race a manual run),
  // and a generation counter so template switches invalidate in-flight work.
  const runRef = useRef<RunResult | null>(null);
  const genRef = useRef(0);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const busy = running || chatBusy;
  const dateError =
    startDate >= endDate ? "Start date must be before the end date." : null;

  // Load templates + apply ?template= / ?run= once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { templates: list } = await fetchTemplates();
        if (cancelled) return;
        setTemplates(list);
        const runParam = searchParams.get("run");
        if (runParam) {
          try {
            const loaded = await fetchRun(runParam);
            if (cancelled) return;
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
        // Flag apples-to-oranges: if the date window changed between runs,
        // suppress numeric comparisons and say so instead.
        const prevRange = runRange(previous);
        const newRange = runRange(result);
        if (previous && prevRange && newRange &&
            (prevRange.start !== newRange.start || prevRange.end !== newRange.end)) {
          setChanges([
            ...specChanges,
            {
              field: "date range",
              from: `${prevRange.start} → ${prevRange.end}`,
              to: `${newRange.start} → ${newRange.end}`,
            },
          ]);
        } else {
          setChanges(specChanges);
        }
        return result;
      } catch (e) {
        if (genRef.current === gen) {
          setError(e instanceof Error ? e.message : "Backtest failed");
        }
        return null;
      } finally {
        if (genRef.current === gen) setRunning(false);
      }
    },
    [startDate, endDate],
  );

  const rangeChanged = useMemo(() => {
    const a = runRange(prevRun);
    const b = runRange(run);
    return Boolean(a && b && (a.start !== b.start || a.end !== b.end));
  }, [prevRun, run]);

  const onSelectTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    genRef.current += 1; // invalidate anything in flight
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
  };

  const onChatSend = async (text: string) => {
    if (!spec || busy) return;
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
      let reply = res.reply;
      if (res.validation_errors.length) {
        reply += `\n\n(The proposed change didn't pass validation: ${res.validation_errors.join("; ")})`;
      }
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
      if (res.updated_spec) {
        const specChanges = diffSpecs(spec, res.updated_spec);
        setSpec(res.updated_spec);
        if (res.should_rerun) {
          await executeRun(res.updated_spec, specChanges);
        } else {
          setChanges(specChanges);
        }
      }
    } catch (e) {
      if (genRef.current === gen) {
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
      await navigator.clipboard.writeText(`${window.location.origin}/runs/${run.run_id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
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

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="sr-only">Backtesting playground</h1>
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-2.5">
        <Link href="/" className="text-sm font-semibold focus-visible:ring-2 focus-visible:ring-accent rounded-sm">
          chat<span className="text-accent">·</span>backtest
        </Link>
        <select
          value={templateId}
          onChange={(e) => onSelectTemplate(e.target.value)}
          disabled={busy}
          aria-label="Strategy template"
          className="rounded-md border border-hairline bg-panel px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        >
          {templateId === "" && <option value="">Loaded run</option>}
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.meta.display_name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Backtest start date"
            className="rounded-md border border-hairline bg-panel px-2 py-1.5 text-xs text-ink focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          →
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={todayISO()}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="Backtest end date"
            className="rounded-md border border-hairline bg-panel px-2 py-1.5 text-xs text-ink focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
        <button
          onClick={() => spec && executeRun(spec, [])}
          disabled={!spec || busy || Boolean(dateError)}
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-background hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40"
        >
          {running ? "Running…" : "Run backtest"}
        </button>
        {dateError && (
          <span className="text-xs text-loss" role="alert">
            {dateError}
          </span>
        )}
        {run?.elapsed_seconds !== undefined && !running && (
          <span className="tnum text-xs text-muted">{run.elapsed_seconds}s</span>
        )}
        <span className="ml-auto hidden text-[11px] text-muted sm:block">
          Research &amp; education only — not financial advice
        </span>
      </header>

      {error && (
        <div role="alert" className="border-b border-hairline bg-loss/10 px-4 py-2 text-sm text-loss">
          {error}
        </div>
      )}

      {/* Main split */}
      <main className="flex flex-1 flex-col gap-3 p-3 lg:flex-row lg:items-start">
        <div className="h-[420px] lg:sticky lg:top-3 lg:h-[calc(100vh-120px)] lg:w-[380px] lg:shrink-0">
          <ChatPanel
            messages={messages}
            busy={chatBusy}
            onSend={onChatSend}
            disabled={!spec || running}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          {changes.length > 0 && <DiffStrip changes={changes} />}

          {run ? (
            <>
              <StatTiles
                stats={run.stats}
                prevStats={rangeChanged ? null : prevRun?.stats ?? null}
              />
              {rangeChanged && (
                <p className="text-[11px] text-muted">
                  Date range changed between runs — before/after comparison hidden
                  (different windows aren&apos;t comparable).
                </p>
              )}
              <div className="rounded-lg border border-hairline bg-panel p-3">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-medium">{run.spec.name}</h2>
                  <div className="flex items-center gap-3">
                    <span className="tnum text-xs text-muted">
                      {fmtMoney(Number(run.stats.starting_capital ?? 100000))} start ·{" "}
                      {(headerRange?.start ?? startDate).slice(0, 4)}–
                      {(headerRange?.end ?? endDate).slice(0, 4)}
                    </span>
                    {run.run_id && (
                      <span className="flex items-center gap-1.5">
                        <Link
                          href={`/runs/${run.run_id}`}
                          className="text-xs text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
                        >
                          Run {run.run_id.slice(-6)}
                        </Link>
                        <button
                          onClick={copyRunLink}
                          className="rounded-md border border-hairline px-2 py-0.5 text-[11px] text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          {copied ? "Copied!" : "Copy link"}
                        </button>
                        {deployedSlug ? (
                          <Link
                            href={`/strategy/${deployedSlug}`}
                            className="rounded-md border border-accent/50 bg-accent-soft px-2 py-0.5 text-[11px] text-accent hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            On the ledger →
                          </Link>
                        ) : (
                          <button
                            onClick={onDeploy}
                            disabled={deploying || busy}
                            title="Freeze this strategy and track it on the public forward-test ledger"
                            className="rounded-md border border-hairline px-2 py-0.5 text-[11px] text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
                          >
                            {deploying ? "Deploying…" : "Deploy to forward test"}
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <EquityChart
                  curve={run.equity_curve}
                  prevCurve={rangeChanged ? null : prevRun?.equity_curve ?? null}
                />
              </div>

              <details className="rounded-lg border border-hairline bg-panel px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Strategy rules (readable, no black box)
                </summary>
                <pre className="tnum mt-3 overflow-x-auto rounded-md bg-background p-3 text-xs leading-relaxed">
                  {JSON.stringify(run.spec, null, 2)}
                </pre>
              </details>

              <div>
                <h3 className="mb-2 text-sm font-medium">
                  Trades <span className="tnum text-muted">({run.trades.length})</span>
                </h3>
                <TradeTable trades={run.trades} />
              </div>

              <p className="text-[11px] text-muted">{run.disclaimer ?? DISCLAIMER}</p>
            </>
          ) : (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg border border-dashed border-hairline">
              <div className="text-center">
                <p className="text-sm text-muted">
                  Pick a template and hit{" "}
                  <span className="font-medium text-ink">Run backtest</span>
                </p>
                <p className="mt-1 text-xs text-muted">
                  Ten years of daily data, usually under ten seconds.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <Suspense
      fallback={<div className="p-8 text-sm text-muted">Loading playground…</div>}
    >
      <PlaygroundInner />
    </Suspense>
  );
}
