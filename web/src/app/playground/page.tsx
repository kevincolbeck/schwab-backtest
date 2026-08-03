"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ChatPanel from "@/components/ChatPanel";
import DiffStrip from "@/components/DiffStrip";
import EquityChart from "@/components/EquityChart";
import StatTiles from "@/components/StatTiles";
import TradeTable from "@/components/TradeTable";
import Button from "@/components/ui/Button";
import Tabs from "@/components/ui/Tabs";
import { createShare, deployRun, fetchRun, fetchTemplates, runBacktest, sendChat } from "@/lib/api";
import { DEFAULT_START_DATE, DISCLAIMER } from "@/lib/constants";
import { diffSpecs } from "@/lib/diff";
import { englishRules } from "@/lib/englishRules";
import { fmtMoney, fmtPct } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
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
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<string>("results");

  useEffect(() => {
    const supabase = supabaseBrowser();
    if (!supabase) {
      setSignedIn(null);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

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

  // ⌘K template jumps while already on /playground only change the query
  // string (no remount), so apply ?template= whenever it changes post-mount.
  const wantedTemplate = searchParams.get("template");
  useEffect(() => {
    if (!wantedTemplate || templates.length === 0) return;
    if (wantedTemplate === templateId) return;
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
    if (id === templateId) return; // re-clicking the active template must not wipe the session
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
    setActiveTab("results");
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

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="sr-only">The Lab — backtesting playground</h1>

      {/* Lab toolbar */}
      <header className="glass sticky top-12 z-30 border-b border-hairline">
        <div className="flex flex-wrap items-center gap-2.5 px-4 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              {spec?.name ?? "The Lab"}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-faint">
              {templateId ? "template" : run ? "loaded run" : "strategy"}
            </p>
          </div>

          {/* mobile-only template select (rail is hidden there) */}
          <select
            value={templateId}
            onChange={(e) => onSelectTemplate(e.target.value)}
            disabled={busy}
            aria-label="Strategy template"
            className="focus-ring rounded-[10px] border border-hairline bg-panel px-2.5 py-1.5 text-sm md:hidden"
          >
            {templateId === "" && <option value="">Loaded run</option>}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.meta.display_name}
              </option>
            ))}
          </select>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-label="Backtest start date"
                className="focus-ring rounded-[10px] border border-hairline bg-panel px-2 py-1.5 text-xs text-ink focus:border-accent"
              />
              →
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={todayISO()}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label="Backtest end date"
                className="focus-ring rounded-[10px] border border-hairline bg-panel px-2 py-1.5 text-xs text-ink focus:border-accent"
              />
            </div>
            <span
              title="Daily bars today — intraday timeframes unlock soon"
              className="tnum hidden rounded-[10px] border border-hairline bg-panel px-2.5 py-1.5 text-xs text-muted sm:block"
            >
              1D
            </span>
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
                className="focus-ring rounded-[10px] border border-hairline px-3 py-1.5 text-xs text-muted hover:text-ink"
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
          <p className="px-2 pb-2 pt-1 text-[10px] uppercase tracking-widest text-faint">
            Templates
          </p>
          <div className="space-y-1">
            {templates.map((t) => {
              const active = t.id === templateId;
              const cagr = t.cached_stats?.stats?.cagr;
              return (
                <button
                  key={t.id}
                  onClick={() => onSelectTemplate(t.id)}
                  disabled={busy}
                  aria-pressed={active}
                  className={`focus-ring w-full rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                    active
                      ? "border-accent/50 bg-accent-soft"
                      : "border-transparent hover:border-hairline hover:bg-panel"
                  }`}
                >
                  <p className="truncate text-sm font-medium">
                    {active && <span aria-hidden="true">▸ </span>}
                    {t.meta.display_name}
                  </p>
                  <p className="mt-0.5 flex items-center justify-between text-[10px] text-faint">
                    <span className="uppercase tracking-wide">{t.meta.category}</span>
                    {typeof cagr === "number" && (
                      <span className="tnum">{fmtPct(cagr, 1)} cagr</span>
                    )}
                  </p>
                </button>
              );
            })}
          </div>
          <div
            title="Describe every rule yourself — the scratch builder is coming soon"
            className="mt-3 cursor-not-allowed rounded-xl border border-dashed border-hairline px-3 py-2.5 text-sm text-faint"
          >
            + Start from scratch
            <span className="ml-1.5 rounded-full border border-hairline px-1.5 text-[9px] uppercase tracking-wide">
              soon
            </span>
          </div>
        </aside>

        {/* Center workspace */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Tabs
              baseId="lab-tabs"
              tabs={[
                { id: "results", label: "Results" },
                { id: "trades", label: "Trades", badge: run?.trades.length ?? undefined },
                { id: "rules", label: "Rules" },
              ]}
              active={activeTab}
              onChange={setActiveTab}
            />
            {run?.run_id && (
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/runs/${run.run_id}`}
                  className="focus-ring rounded-md text-xs text-accent hover:underline"
                >
                  Run {run.run_id.slice(-6)}
                </Link>
                <Button size="sm" variant="ghost" onClick={copyRunLink}>
                  {copied ? "Copied!" : "Share"}
                </Button>
                {deployedSlug ? (
                  <Link
                    href={`/strategy/${deployedSlug}`}
                    className="focus-ring rounded-lg border border-accent/50 bg-accent-soft px-2.5 py-1 text-xs text-accent hover:opacity-90"
                  >
                    On the ledger →
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onDeploy}
                    disabled={deploying || busy}
                    title="Freeze this strategy and track it on the public forward-test ledger"
                  >
                    {deploying ? "Deploying…" : "Deploy to forward test"}
                  </Button>
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
                    prevStats={rangeChanged ? null : prevRun?.stats ?? null}
                  />
                  {rangeChanged && (
                    <p className="text-[11px] text-faint">
                      Date range changed between runs — before/after comparison hidden
                      (different windows aren&apos;t comparable).
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
                      prevCurve={rangeChanged ? null : prevRun?.equity_curve ?? null}
                    />
                  </div>
                  <p className="text-[11px] text-faint">{run.disclaimer ?? DISCLAIMER}</p>
                </div>
              )}

              {activeTab === "trades" && (
                <div
                  role="tabpanel"
                  id="lab-tabs-panel-trades"
                  aria-labelledby="lab-tabs-trades"
                  className="space-y-2"
                >
                  <TradeTable trades={run.trades} />
                  <p className="text-[11px] text-faint">
                    Per-trade candlestick inspection is coming next — every entry and
                    exit on the actual chart.
                  </p>
                </div>
              )}

              {activeTab === "rules" && rules && (
                <div
                  role="tabpanel"
                  id="lab-tabs-panel-rules"
                  aria-labelledby="lab-tabs-rules"
                  className="space-y-3"
                >
                  <div className="card p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-semibold">Rules in plain English</h2>
                      <Button size="sm" variant="outline" onClick={downloadSpec}>
                        ↓ Download spec
                      </Button>
                    </div>
                    <dl className="space-y-4 text-sm leading-relaxed">
                      <div>
                        <dt className="text-[11px] uppercase tracking-wide text-faint">Universe</dt>
                        <dd className="mt-1">{rules.universe}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] uppercase tracking-wide text-faint">Entry</dt>
                        <dd className="mt-1 space-y-1">
                          {rules.entry.map((s) => (
                            <p key={s}>{s}</p>
                          ))}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] uppercase tracking-wide text-faint">Exits</dt>
                        <dd className="mt-1 space-y-1">
                          {rules.exits.map((s) => (
                            <p key={s}>{s}</p>
                          ))}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] uppercase tracking-wide text-faint">Sizing</dt>
                        <dd className="mt-1">{rules.sizing}</dd>
                      </div>
                    </dl>
                    <p className="mt-4 border-t border-hairline pt-3 text-[11px] leading-relaxed text-faint">
                      Written so you could trade it by hand. Simulated results include a
                      slippage assumption; manual execution will differ.
                    </p>
                  </div>
                  <details className="card px-5 py-4">
                    <summary className="focus-ring cursor-pointer rounded-md text-sm font-medium">
                      The spec (exact rules, no black box)
                    </summary>
                    <pre className="tnum slim-scroll mt-3 overflow-x-auto rounded-xl bg-background p-4 text-xs leading-relaxed">
                      {JSON.stringify(run.spec, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </>
          ) : (
            <div className="card flex min-h-[380px] items-center justify-center border-dashed">
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
        <div className="hidden h-[calc(100vh-140px)] w-[340px] shrink-0 lg:sticky lg:top-[104px] lg:block xl:w-[380px]">
          <ChatPanel
            messages={messages}
            busy={chatBusy}
            onSend={onChatSend}
            disabled={!spec || running}
          />
        </div>
      </main>

      {/* Chat on small screens (below workspace) */}
      <div className="h-[420px] p-3 pt-0 lg:hidden">
        <ChatPanel
          messages={messages}
          busy={chatBusy}
          onSend={onChatSend}
          disabled={!spec || running}
        />
      </div>
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
