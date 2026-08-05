import type { ComponentType, ReactNode } from "react";
import BacktestVsForwardTest from "./BacktestVsForwardTest";
import DonchianBreakout from "./DonchianBreakout";
import GoldenCross from "./GoldenCross";
import MacdBacktest from "./MacdBacktest";
import NoCodeBacktesting from "./NoCodeBacktesting";
import VwapReversion from "./VwapReversion";

/** slug → article body. Every BLOG_POSTS entry needs a row here — the map is
 * pinned two ways: a vitest invariant in web/src/lib/blog.test.ts, and a
 * loud throw in the article route (the app renders per-request, so a build
 * can't catch the drift). */
export const ARTICLE_BODIES: Record<
  string,
  ComponentType<{ stats?: ReactNode }>
> = {
  "does-the-golden-cross-work": GoldenCross,
  "macd-strategy-backtest": MacdBacktest,
  "donchian-breakout-strategy": DonchianBreakout,
  "vwap-strategy-backtest": VwapReversion,
  "backtest-vs-forward-test": BacktestVsForwardTest,
  "how-to-backtest-a-trading-strategy-without-code": NoCodeBacktesting,
};
