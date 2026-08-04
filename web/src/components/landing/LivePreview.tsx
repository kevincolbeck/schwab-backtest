"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import EquityChart from "@/components/EquityChart";
import Button from "@/components/ui/Button";
import { useAuthModal } from "@/components/AuthModal";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fmtPct, fmtSignedPct } from "@/lib/format";
import demo from "@/data/demo-run.json";

/* The hero's proof object, evidence-treated (SYSTEM.md §3): every number and
   date below is REAL — baked from an actual Golden Cross run
   (data/demo-run.json). Mono/tabular stats, whispering labels, and the run's
   real bar-date range as the timestamp mark. Truth rule: nothing here is
   illustrated. */
const RANGE_START = demo.equity_curve[0].date.slice(0, 10);
const RANGE_END = demo.equity_curve[demo.equity_curve.length - 1].date.slice(0, 10);

/* `pnl` carries the real value so valence color is derived from its sign —
   never asserted decoratively (SYSTEM.md §2). */
const STATS: Array<{ label: string; value: string; pnl: number | null }> = [
  {
    label: "Total return",
    value: fmtSignedPct(demo.stats.total_return_pct, 0),
    pnl: demo.stats.total_return_pct,
  },
  { label: "CAGR", value: fmtPct(demo.stats.cagr, 2), pnl: demo.stats.cagr },
  { label: "Max drawdown", value: fmtPct(demo.stats.max_drawdown, 1), pnl: null },
  { label: "Trades", value: String(demo.stats.total_trades), pnl: null },
];

/** Real, interactive lab preview — baked from an actual Golden Cross run.
 *  Fullscreen requires an account (the lab is members-only). */
export default function LivePreview() {
  const router = useRouter();
  const { openAuth } = useAuthModal();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    if (!supabase) return; // signedIn stays at its initial null
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  const goFullscreen = () => {
    if (signedIn) {
      router.push("/playground?template=golden-cross");
    } else {
      openAuth("Create a free account to open the full lab — no card required.");
    }
  };

  return (
    /* Hover ring only — the hero CTA is the viewport's ONE idle ring
       (SYSTEM.md §5: never two idle-animating rings in a viewport). */
    <div className="gloss-ring-hover rounded-(--radius-card)">
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
          <div>
            <p className="text-sm font-medium text-ink">{demo.name}</p>
            <p className="tnum text-caption text-faint">
              {RANGE_START} → {RANGE_END} · daily · real data, live crosshair
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={goFullscreen}>
            Go fullscreen ↗
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-px border-b border-hairline bg-hairline sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-panel px-3 py-2">
              <p className="text-caption uppercase tracking-wide text-faint">{s.label}</p>
              <p
                className={`tnum text-sm ${
                  s.pnl === null ? "text-ink" : s.pnl < 0 ? "text-loss" : "text-gain"
                }`}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>
        <div className="px-2 pb-2 pt-3">
          <EquityChart curve={demo.equity_curve} height={230} />
        </div>
      </div>
    </div>
  );
}
