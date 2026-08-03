"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import EquityChart from "@/components/EquityChart";
import Button from "@/components/ui/Button";
import { useAuthModal } from "@/components/AuthModal";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fmtPct, fmtSignedPct } from "@/lib/format";
import demo from "@/data/demo-run.json";

const STATS = [
  { label: "Total return", value: fmtSignedPct(demo.stats.total_return_pct, 0), pnl: true },
  { label: "CAGR", value: fmtPct(demo.stats.cagr, 2), pnl: true },
  { label: "Max drawdown", value: fmtPct(demo.stats.max_drawdown, 1), pnl: false },
  { label: "Trades", value: String(demo.stats.total_trades), pnl: false },
];

/** Real, interactive lab preview — baked from an actual Golden Cross run.
 *  Fullscreen requires an account (the lab is members-only). */
export default function LivePreview() {
  const router = useRouter();
  const { openAuth } = useAuthModal();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    if (!supabase) return setSignedIn(null);
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
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
        <div>
          <p className="text-sm font-medium">{demo.name}</p>
          <p className="tnum text-[11px] text-faint">
            {demo.params.start_date.slice(0, 4)}–{demo.params.end_date.slice(0, 4)} · daily ·
            real data, live crosshair
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={goFullscreen}>
          Go fullscreen ↗
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-px border-b border-hairline bg-hairline">
        {STATS.map((s) => (
          <div key={s.label} className="bg-panel px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-faint">{s.label}</p>
            <p className={`tnum text-sm ${s.pnl ? "text-gain" : ""}`}>{s.value}</p>
          </div>
        ))}
      </div>
      <div className="px-2 pb-2 pt-3">
        <EquityChart curve={demo.equity_curve} height={230} />
      </div>
    </div>
  );
}
