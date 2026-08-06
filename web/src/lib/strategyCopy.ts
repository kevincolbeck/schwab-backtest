/** Section 4 interpretation copy — the ">=150 words of unique
 * interpretation per strategy" the spec requires, and the reason these 14
 * pages clear Google's bar for programmatic content rather than reading as
 * a template stamped 14 times.
 *
 * TRUTH RULE (same as the blog, made structural): this prose contains NO
 * performance figures. Every number on the page renders live from the
 * engine beside this text, so a data refresh can never strand a stale claim
 * inside a sentence. The copy describes the SHAPE of a strategy's returns —
 * why the win rate is low by construction, why the drawdowns cluster — which
 * stays true across refreshes. `strategyCopy.test.ts` fails the build on a
 * percentage or a dollar figure appearing here.
 *
 * Two of these strategies LOST money over the tested window. Their copy says
 * so plainly. Publishing losers intact is the entire brand.
 */

export interface StrategyEdit {
  /** A plain-English instruction a user can type into the chat. */
  edit: string;
  why: string;
}

export interface StrategyCopy {
  /** 2-3 paragraphs. The page's reason to exist. */
  whatTheNumbersMean: string[];
  /** The single most misleading thing about this record. */
  honestCaveat: string;
  /** Exactly 3 — these feed the "test a variation" CTA. */
  editsWorthTrying: StrategyEdit[];
  whoItSuits: string;
}

export const STRATEGY_COPY: Record<string, StrategyCopy> = {
  "52-week-high": {
    whatTheNumbersMean: [
      "This is trend-following, and the record carries the usual asymmetry: most closed trades lost money, and the total still finished the window ahead because the few that worked ran far longer than the many that didn't. The low win rate is the design, not a fault. Entry wants a close within 5% of the 252-day high with price above the 200-day average, a condition that flickers on and off in choppy advances, and the only exit is a close under the 50-day average: no stop, no target, no holding limit. A name gets bought near its high, shaken out on an ordinary dip, bought back weeks later, each round trip booking a small loss.",
      "The universe is twelve large US names, the book holds at most five, a fifth of capital each, so when signals cluster the portfolio is concentrated and internally correlated: the deep drawdowns are market drawdowns hitting every holding at once, not one bad pick. And a trailing average is not a stop. The gap between price and the 50-day widens as a position runs, so a sharp reversal hands back a large open gain before the exit is ever met.",
      "Read the win rate and the profit factor as a pair; neither says much alone. Check whether the drawdown is shallower than holding these twelve names outright over the span, which is the case for the 200-day filter. Weigh the trade count against a decade and twelve symbols: a high count means the 50-day exit cycles often, which is where unmodeled trading costs would land.",
    ],
    honestCaveat: "The twelve symbols were picked in the present, and they are the large caps that already dominated the tested decade. A trend rule pointed at names known in advance to have trended flatters itself. Run without hindsight, the same list would have carried the megacaps that stalled, split, or were quietly replaced, and that version of the record does not exist here.",
    editsWorthTrying: [
      { edit: "Replace the twelve megacaps with fifty S&P names chosen without regard to how they performed, including the laggards", why: "It separates how much of this record belongs to the rules from how much belongs to the roster, which is the question the hand-picked universe leaves open." },
      { edit: "Require an actual new 252-day high on entry instead of anything within 5% of it", why: "It shows whether the 5% band is the source of the many small losses, buying names that stall just short of a breakout, or whether it is the only thing keeping the strategy invested at all." },
      { edit: "Change the exit from a close under the 50-day average to a close under the 100-day, and rerun", why: "A slower trailing exit should cut the whipsaw churn and lift the win rate while widening the giveback on each exit, which makes the trade-off between trade count and average loss visible." },
    ],
    whoItSuits: "This suits someone who can sit through being wrong on most positions and through drawdowns that arrive across the whole book at once; it does not suit anyone who wants frequent wins, a defined loss on every trade, or a return stream that behaves differently from large-cap US stocks.",
  },
  "bollinger-reversion": {
    whatTheNumbersMean: [
      "The win rate here is high by construction, and that is mechanical, not a compliment. Entry demands a close more than two standard deviations below the 20-day average; the exit asks only that price recover to that same average. The target sits close to the entry, and it drifts down toward price as the average follows the decline, so the bar each trade must clear keeps lowering itself. Expect many small, quickly resolved wins punctuated by fewer and larger losses: positions that never snap back have no stop to cut them, only the fifteen-day clock.",
      "The 200-day filter is the load-bearing rule. It refuses the setup unless the stock is still above its long-term average, keeping the strategy out of genuine collapses — and standing it down during the stretches when two-sigma dislocations are most common. What is left spends most of the tested window in cash: at most five concurrent positions drawn from a ten-name list, each a tenth of the account, triggered only by a rare condition. Shallow drawdowns follow from that idleness rather than from any risk control in the rules.",
      "Whatever the return line shows, it was produced by capital that sat out most of the window, so read it against exposure, not against holding the same ten names outright. Compare win rate with profit factor: together they describe how much larger the average loss is than the average win. Then check whether trades cluster into a few volatile stretches, because a decade of history built from a handful of busy months is thinner than the trade count suggests.",
    ],
    honestCaveat: "The ten symbols are megacaps chosen with a decade of hindsight; every one of them survived and trended up through the tested window, which is precisely the condition the 200-day filter and the reversion premise both need. Names that looked equally durable at the start of the window and later stumbled are absent. That selection, not the band logic, may be doing much of the work.",
    editsWorthTrying: [
      { edit: "Add an 8% stop loss and re-run it", why: "This spec carries no stop at all, so the fifteen-day clock is the only thing that closes a losing position, and adding a hard stop shows how much of the record depended on letting drawdowns ride to the deadline." },
      { edit: "Remove the 200-day moving average filter", why: "It lets the same band signal trade in downtrends, separating whether the results come from mean reversion itself or from only ever buying dislocations inside stocks that were already rising." },
      { edit: "Exit at the upper band instead of the middle band", why: "It swaps a target that drifts toward price for one that runs away from it, testing whether the current exit is a genuine recovery signal or simply a low hurdle." },
    ],
    whoItSuits: "It suits someone studying how mean reversion behaves inside strong uptrends and comfortable with capital sitting idle for long stretches; it does not suit anyone who wants their capital continuously deployed, or who reads a high win rate as evidence of safety.",
  },
  "buy-the-dip": {
    whatTheNumbersMean: [
      "Folklore made exact enough to fail. The first thing to notice is how seldom the rule fires: both filters must agree, so the ETF has to slide a few percent across a five-session stretch while still holding above its 200-day average. Ordinary drift doesn't qualify, and a genuine bear market disqualifies itself — once price breaks that line, buying stops. Most of the tested decade is spent holding nothing, so the annualized figure is an average smeared across long flat stretches rather than something earned by staying invested.",
      "The trade-level shape mirrors a trend follower's, inverted. Winners are capped by the profit target; losers have no stop at all — the exit field is empty, and only the ten-day clock ends a bad trade. That asymmetry produces a comfortable-looking win rate with a modest profit factor behind it: many small quick exits, plus a minority of trades that sit through whatever two weeks can deliver. Read the profit factor and the drawdown before the win rate.",
      "Concentration compounds this. Half the account per position, two positions maximum, and two large-cap US indices that rarely disagree — when one triggers the other usually does, so being fully invested means one directional bet at full size. Over this window the result was positive but faint: not a loser, just rarely in the market long enough to compound much. The Sharpe is where the idle cash and the uncapped losing tail both show up.",
    ],
    honestCaveat: "SPY and QQQ are not two bets — they move nearly in lockstep, so the trade count roughly halves once you count independent events, which is thin for a decade. Both tickers were also chosen knowing how the last ten years treated large-cap US indices, and the 200-day filter then removes the crashes, so the record mostly describes one long uptrend behaving as uptrends do.",
    editsWorthTrying: [
      { edit: "Remove the 200-day average filter so it enters during downtrends too", why: "The dips the folklore is famous for are precisely the ones this rule refuses, and dropping the filter shows whether skipping them protected the record or hollowed it out." },
      { edit: "Add a five percent stop loss", why: "The spec has no stop today, so a bad trade rides the full ten days; adding one tests whether that tail is the real cost or whether cutting mean-reversion trades early makes things worse." },
      { edit: "Replace SPY and QQQ with a basket of ten individual large-cap stocks", why: "This separates index-level mean reversion from simply being long a rising market, and breaks the one-bet-counted-twice concentration built into the current universe." },
    ],
    whoItSuits: "It suits someone checking a piece of received wisdom against a decade of data who can tolerate sitting in cash for most of it; it does not suit anyone wanting continuous exposure, frequent activity, or a rule set they could size up, since nothing but the calendar closes a losing trade.",
  },
  "donchian-breakout": {
    whatTheNumbersMean: [
      "The Donchian rule is reactive rather than predictive, and the shape of the returns follows directly from that. Entry only fires after the close has already cleared the highest high of the prior twenty sessions, so every position starts late. The exit only fires after the close breaks the prior ten-day low, so every position ends late too. The distance between a trade's peak and the ten-day low beneath it is handed back on every single winner, by design. That giveback is most of what the drawdown figure is measuring here — less a run of bad trades than the structural cost of never selling anywhere near a top.",
      "The two clocks are deliberately asymmetric: twenty days to get in, ten to get out. Being quicker to leave than to arrive keeps the losing tail short, which is why the hit rate lands closer to a coin flip than the usual breakout caricature of many tiny losses and one rare enormous win. The payoff still comes from size rather than frequency. The 8% stop sits underneath names that can travel that far on a single earnings gap, so it frequently resolves a trade before the channel gets a vote at all, converting what would have been a channel exit into a fixed-size loss.",
      "Concentration is the other defining parameter. Twenty percent per position across five slots means a fully committed book of five correlated mega-caps whose breakouts tend to fire in the same week. Read the win rate and the profit factor together — the gap between them is the whole asymmetry, and either number alone misleads. Then read drawdown against the annualised figure, and keep in mind there is no take profit and no holding limit: the right tail did the heavy lifting, and it was paid for with long flat stretches in cash when nothing was making new highs.",
    ],
    honestCaveat: "The ten symbols are the mega-caps everyone now knows worked, picked with the benefit of hindsight. A list drawn in 2016 by the same reasoning would have held different names, and several of them would have gone nowhere for a decade. Selection of the universe, rather than the channel logic itself, is plausibly the largest single contributor to this record.",
    editsWorthTrying: [
      { edit: "Replace the ten mega-caps with ten large caps that looked strong back in 2016 — IBM, Intel, GE, Exxon, Cisco, Coca-Cola, AT&T, Pfizer, Walmart and Johnson & Johnson", why: "It runs the identical channel rules on a universe chosen without hindsight, which is the quickest way to see how much of this record belongs to the rules and how much belongs to the symbol list." },
      { edit: "Change the exit from a 10-day low to a 20-day low", why: "It restores Donchian's symmetric channel and shows whether the faster exit was protecting capital or clipping the long winners the payoff structure depends on." },
      { edit: "Add a 15% take profit", why: "Capping the upside tests how much of the result rested on a few positions running unbounded versus on the many ordinary ones, which is exactly what a near-coin-flip hit rate hides." },
    ],
    whoItSuits: "This suits someone who can sit in cash for months and then watch a large open gain shrink by a full channel width before the exit triggers; it does not suit anyone who wants frequent activity, a smooth equity curve, or real diversification, because five slots drawn from ten correlated mega-caps is close to a single position.",
  },
  "dual-momentum": {
    whatTheNumbersMean: [
      "This strategy spends most of its life holding one thing and doing nothing. Across a decade of daily bars it makes a handful of decisions, not hundreds, so the record is a few long holds rather than the law of large numbers. The win rate sits near a coin flip, but the sizes are wildly asymmetric: with no stop, no profit target and no holding limit, a winner is kept until its six-month return turns negative, which for a trending asset can take years, while a fader is cut once that same measure rolls over.",
      "The six-month lookback is slow by design: it buys well after a move starts and sells well after it ends, so missing tops and bottoms is arithmetic, not misfortune. The absolute-momentum valve, stand aside when nothing is rising, therefore helps in grinding bear markets and barely at all in sudden ones, since a crash measured in weeks cannot turn a six-month return negative until months later. One position at full notional from a menu of six ETFs makes concentration total, and because this version only reconsiders the menu after an exit rather than monthly, it can ride one holding for years.",
      "Beside this text, read the drawdown as the cost of that slowness, and read the profit factor against the trade count: with this few closed trades, one or two holds carry it. Then ask the harder question, whether the detours into gold, bonds and cash paid for the lag, or whether the window simply rewarded owning stocks.",
    ],
    honestCaveat: "The whole record rests on very few closed trades spread over roughly a decade, few enough that a different entry date on one hold would reshape the headline figures. And the window was dominated by a long equity uptrend, so the strategy mostly just held stocks; the gold, bond and cash machinery it exists for was rarely the thing under test. The menu itself was picked with hindsight.",
    editsWorthTrying: [
      { edit: "Shorten the momentum lookback from six months to three", why: "A faster ranking signal switches assets more often and leaves crashes sooner, so this shows whether the lag is protecting the record or costing it, and how much whipsaw the shorter window buys." },
      { edit: "Rebalance monthly to whichever ETF ranks highest, instead of only reconsidering after an exit", why: "That restores the original dual-momentum rule and separates how much of the result came from the ranking logic versus from this version's habit of riding one holding for years." },
      { edit: "Remove GLD and TLT from the menu so cash is the only alternative to equities", why: "It isolates whether the defensive assets ever actually earned their place, or whether the record is equity exposure with occasional time off." },
    ],
    whoItSuits: "It suits someone willing to sit in a single holding, or in cash, for months at a time without interfering and who judges a method over years rather than weeks; it does not suit anyone who wants frequent activity, quick feedback, or shelter from a fast crash.",
  },
  "golden-cross": {
    whatTheNumbersMean: [
      "This is a rule set with very few decisions in it. A 50-day average has to climb above a 200-day average, which is a slow event, and the only way back out is the same pair crossing the other way. There is no stop loss, no profit target and no maximum holding period, so a position that opens can stay open for years. What you get is a record built from a handful of long holds rather than a distribution of many trades.",
      "That structure sets the shape of everything rendered beside this text. The win rate is high by construction: the trend has to be established before the entry fires, so the signal arrives late and mostly confirms something already underway. The flip side is that the exit arrives late too. A death cross needs months of falling prices to form, so the strategy sits through the whole first half of a decline before the rule says anything. Read the drawdown figure as the price of that lag, not as a flaw in the test.",
      "Two things deserve scrutiny. The trade count is small — a crossover this slow fires only a few times per symbol — so the profit factor and win rate describe particular holds rather than a repeatable process, and a single long hold can dominate the profit-factor line. And the five tickers are not five independent bets: SPY and QQQ overlap heavily with AAPL, MSFT and NVDA, so the 20%-per-position sizing that looks diversified behaves closer to one concentrated position that enters and exits together.",
    ],
    honestCaveat: "The symbol list is the problem. AAPL, MSFT and NVDA were chosen knowing how they turned out, and the tested window covers the run that made them famous. A crossover rule applied to five survivors of a megacap bull market inherits their history rather than proving anything about crossovers. Swap in names that stalled or were acquired and the same rules produce a very different record.",
    editsWorthTrying: [
      { edit: "Change the moving averages from 50 and 200 to 20 and 100 and run it again", why: "A faster pair fires far more often, which shows whether the small trade count was flattering the record or whether the slowness was doing the real work." },
      { edit: "Replace the symbols with a spread of sector ETFs like XLE, XLF, XLU, XLI and XLV", why: "It separates the crossover rule from the specific megacaps, since the current list is three of the best-known winners of the tested era plus two indexes that hold them." },
      { edit: "Exit when the close drops below the 200-day average instead of waiting for the 50-day to cross under it", why: "The death cross is the slowest exit available, so this measures how much of the drawdown came from that lag and how many good holds a quicker exit would have cut short." },
    ],
    whoItSuits: "This suits someone studying how a slow, mechanical trend filter behaves on a long-only basket and who can watch a full market decline develop before the exit rule reacts; it does not suit anyone who wants frequent activity, tight loss control, or a result that generalizes past these five names.",
  },
  "macd-trend": {
    whatTheNumbersMean: [
      "The win rate here sits near a coin flip, and that is not the interesting part. The only exit is the reverse crossover — there is no stop, no profit target, and no holding-period limit — so a position that turns out wrong is closed once the 12-day average slips back under the 26-day, usually soon after a false start and for a modest loss, while a position that keeps working has nothing to close it. Compare the profit factor tile against the win rate tile: that gap is the mechanism.",
      "The 12/26 exponential pair on daily bars turns faster than the classic 50/200 pair, which puts the strategy into real trends earlier and also into a lot of moves that immediately fail. Expect stretches where the curve goes sideways while small round trips accumulate. Because nothing caps the downside inside a trade, the lag of the two averages is the only protection: in a sharp decline the cross-down arrives well after the high, so the worst open loss on a single name can be far deeper than the closed loss on the trade list suggests. The drawdown chart is where that shows up.",
      "Then there is the universe. Five symbols, at a fifth of capital each: two broad index funds and three megacap tech names that those same funds hold in size. When all five are long, this is closer to one trade than five. Check whether the big steps in the equity curve trace back to a single ticker.",
    ],
    honestCaveat: "The universe is the problem. Three of these five tickers were among the strongest large caps of the sample period, and both ETFs hold them heavily, so the symbol list may be doing more work than the crossover parameters. A trend rule of almost any speed would have looked reasonable on these names over this window. Swap the symbols before trusting the shape.",
    editsWorthTrying: [
      { edit: "Run the same crossover rules on ten large caps outside technology instead of these five symbols", why: "It separates what the 12/26 crossover contributes from what a decade of megacap tech strength contributed." },
      { edit: "Add a stop that closes a position when it falls eight percent below the entry price", why: "It shows how much of the drawdown comes from waiting for the lagging cross-down, and what capping that costs in trends the strategy would otherwise have held." },
      { edit: "Only take an entry when the 26-day EMA is also rising, and show how many trades that removes", why: "It isolates the whipsaw trades taken in flat markets and reveals whether the losing half of the record is mostly chop." },
    ],
    whoItSuits: "This suits someone comfortable holding through months of open profit and handing a visible chunk of it back at the exit; it does not suit anyone who needs most trades to be winners, a defined worst case per position, or genuine diversification across names that do not move together.",
  },
  "minervini-trend": {
    whatTheNumbersMean: [
      "This is a trend-follower with the brakes taken off the winners: there is no take-profit and no maximum holding period, so a position stays open until price closes back under its 50-day average or the 8% stop is hit. That asymmetry defines the return profile. Most trades end small and red — the stack of averages breaks not long after it forms — while a minority of positions ride for months and carry the entire record. A low win rate here is the design, not a defect.",
      "Requiring the 50-day above the 150-day above the 200-day means the trend must already be well established before anything is bought, so entries are structurally late and exits give back part of every top. The RSI filter above 55 thins out names that are technically aligned but going nowhere. Because the exit is a moving average rather than a fixed percentage, positions get room to shake — and that room shows up as genuine peak-to-trough drawdown. With a fifth of the account per name and five slots, one megacap's bad quarter is visible in the whole curve.",
      "Over the window shown, this rule set ends higher than it began, so the interesting question is shape rather than sign. Read the profit factor beside the win rate — the gap between them is the entire mechanism. Then set the maximum drawdown against the annualized figure and ask whether you would have kept taking signals through the worst stretch, because the record assumes you did.",
    ],
    honestCaveat: "The symbol list is the problem. Fifteen megacaps chosen today are fifteen stocks already known to have trended for a decade, so testing a trend-following rule on them is close to asking whether trends existed in stocks that trended. Nothing here shows how the rules behave on names that stalled, faded, or never recovered, and those names existed too.",
    editsWorthTrying: [
      { edit: "Swap the fifteen megacaps for a broader, messier universe that includes names which stalled or faded after 2016", why: "It separates how much of this record comes from the rules and how much comes from a symbol list assembled with hindsight." },
      { edit: "Widen the 8 percent stop to 15 percent, then run it again with no stop at all", why: "It shows how often the stop fires inside ordinary megacap noise before the moving-average exit ever gets a say, and whether those cuts helped or just harvested losses." },
      { edit: "Change the exit to a close below the 150-day average instead of the 50-day", why: "It trades shakeout tolerance for give-back at the top, producing fewer and longer holds and a visibly different drawdown shape." },
    ],
    whoItSuits: "It suits a patient holder who can leave a winner alone for months and let most trades close red without touching the rules, and it does not suit anyone who wants frequent wins, a smooth curve, or something to do each week.",
  },
  "qullamaggie-breakout": {
    whatTheNumbersMean: [
      "Momentum Breakout asks for three things at once: a stock already up more than thirty percent over the prior quarter, a close above its own fifty-day high, and volume well above its twenty-day average. You arrive late by construction — the entry fires only after the move is obvious to everyone. Over the tested decade, on this universe, arriving late produced plenty of activity and very little accumulated progress, plus a drawdown deep enough that the ride mattered more than the destination.",
      "The exit is where the shape comes from. A close below the ten-day moving average ends the trade, and for names like TSLA, PLTR, or NET an ordinary pullback inside an intact uptrend crosses that line constantly. There is no profit target and no holding limit, so that cross is the only door a winner leaves by — the rare position that should pay for ten small losses gets cut early. The eight-percent stop applies one distance to every symbol regardless of how far each normally travels. Fewer than half the trades work, and the winners finish only barely large enough to cover the losers.",
      "Concentration supplies the rest. Twenty percent per position across five slots, drawn from nineteen correlated high-beta names, means the book fills in one regime and empties in the next — which is how a per-trade stop that sounds tight sits beside a portfolio drawdown many times its size. Beside this text, set the annualized return against the worst drawdown, see how close the profit factor sits to break-even, and read the Sharpe as the verdict on both.",
    ],
    honestCaveat: "The universe is the problem. These nineteen names were chosen in hindsight as the decade's momentum standouts, and several of them — PLTR, CRWD, NET, DDOG, UBER — were not public when the window opens. So the rules were handed close to the friendliest imaginable hunting ground and still came out near flat. Read this as a generous upper bound, not a neutral test.",
    editsWorthTrying: [
      { edit: "Change the exit from a close below the 10-day moving average to a close below the 20-day", why: "It tests whether the fast exit is what truncates the rare large winner this entry pattern depends on to pay for its losers." },
      { edit: "Widen the stop from 8 percent to 15 percent", why: "It separates trades that were stopped by ordinary volatility in these fast names from trades where the breakout genuinely failed." },
      { edit: "Replace the nineteen symbols with a broader list that includes slower, lower-beta names", why: "It shows how much of the record belongs to the rules and how much belongs to a universe assembled with the benefit of hindsight." },
    ],
    whoItSuits: "It suits someone studying why a well-known entry pattern can fail to compound once the exit and the concentration are specified this way, and not someone looking for a rule set that worked over this window — on these parameters and this universe, it essentially did not.",
  },
  "range-breakout-15m": {
    whatTheNumbersMean: [
      "This one lost money over the tested window, and the mechanism is not mysterious. The entry buys the close of the bar that has just made a new high for the session, which is the moment intraday enthusiasm is most fully expressed and most likely to be given back. The exits then clip whatever survives: a close under the 20-bar EMA is roughly five hours of leash, and a two-day clock closes the trade regardless. So the losses arrive at full size while the wins are cut before they can grow into anything.",
      "The parameters sharpen that shape. A 1.5% stop sits inside ordinary 15-minute noise on NVDA and TSLA, so it fires on wiggle rather than on the idea being wrong. The 26-bar lookback spans about one session including extended hours, so the range being cleared is partly thin premarket trade. And the universe is four tickers, two of which, SPY and QQQ, move together most days, so there is less diversification here than the count suggests. With a quarter of the account per position and two positions at most, the portfolio drawdown stays milder than the per-trade experience.",
      "Read profit factor against its breakeven of one rather than against the daily templates elsewhere on this site; it asks only whether the winners paid for the losers. Then compare the worst drawdown with the whole-period result: if they match, the equity peak came early and nothing after it recovered. And treat the annualized rate and the Sharpe as arithmetic on a few weeks of bars, not a description of a year.",
    ],
    honestCaveat: "The annualized return and Sharpe are extrapolations from an intraday window measured in weeks, run over that span because that is as far back as the 15-minute data reaches. Stretching a few weeks of one regime into a yearly rate makes both the loss and the risk figure look more dramatic than the evidence can support. The four tickers were also picked with hindsight about which names traded heavily.",
    editsWorthTrying: [
      { edit: "Change the stop from 1.5% to 3% and re-run it", why: "It separates damage caused by a stop sitting inside routine 15-minute noise from damage caused by the breakouts genuinely failing." },
      { edit: "Swap the exit to a 50-bar EMA and raise the max holding period to five days", why: "It gives surviving trades room to develop, showing whether winners were being clipped early or were never there in the first place." },
      { edit: "Run the same rules on 60-minute bars instead of 15-minute bars", why: "It tests whether the breakout logic itself or the noise of the shorter timeframe is responsible, and lines the result up against the daily-bar Donchian cousin." },
    ],
    whoItSuits: "It suits a reader studying how breakout logic behaves when compressed to intraday bars and short leashes, and it does not suit anyone shopping for a rule set to trade or anyone who needs a long, multi-regime record before drawing conclusions.",
  },
  "rsi2-mean-reversion": {
    whatTheNumbersMean: [
      "Whatever the record beside this text shows, it was assembled in small pieces. An RSI-2 reading under 10 is an extremely fast oversold trigger, and the exit fires on the first close back above the 5-day average, so trades are numerous and short. Nothing in the rules lets a winner run, and nothing cuts a loser early, so the two end up similar in average size and no single trade carries the outcome. Expect a staircase of shallow steps rather than a few decisive leaps.",
      "The parameters do specific things to that character. There is no stop loss here at all: the only backstops are the 5-day exit and the ten-day holding limit, so a dip that keeps dipping is held to the clock. The 200-day filter blocks entries in broken names but is slow enough to stay green well into a decline. And because ten correlated megacaps go oversold together, the five-position cap tends to bind on exactly the ugliest days, concentrating rather than spreading the risk it was meant to spread.",
      "Read the profit factor next to the win rate. If wins outnumber losses while the profit factor sits only a little above one, the record rests on trade count rather than trade quality, which makes it sensitive to the per-fill slippage the engine charges, multiplied across every round trip. Then note how much of the time this sits in cash: a shallow drawdown bought with idle capital is not the same thing as skill at avoiding losses.",
    ],
    honestCaveat: "The ten symbols are today's megacaps, picked with hindsight. Buying dips in stocks already known to have survived and recovered over the tested decade is a friendlier test than these rules faced in real time, when the list would have included names that stalled and never came back. The 200-day filter cannot rescue you from a universe chosen after the fact.",
    editsWorthTrying: [
      { edit: "Remove the 200-day moving average filter so it buys every oversold dip, not only dips inside uptrends", why: "Separates how much of the record comes from the trend condition versus the RSI-2 trigger itself, and shows whether the filter is what keeps the drawdown shallow." },
      { edit: "Change the exit to the first close above the 10-day average instead of the 5-day", why: "The fast exit is the strategy's signature; slowing it reveals whether it truncates bounces or protects against bounces that never arrive, and it moves the winner-versus-loser size balance directly." },
      { edit: "Run the same rules on ten mid-cap or recently beaten-down names instead of the ten megacaps", why: "Tests the hindsight-universe problem head on, since mean reversion behaves very differently in names without a decade of recovery behind them." },
    ],
    whoItSuits: "It suits someone who wants to watch a well-documented mean-reversion mechanic work in slow motion across a large number of small, short trades and who accepts sitting in cash much of the time; it does not suit anyone who wants few decisions, results that keep pace with simply owning the same ten names, or a rule set with an explicit stop loss, because this one has none.",
  },
  "sell-in-may": {
    whatTheNumbersMean: [
      "There is no indicator here. The entry test is a month number, and so is the exit — hold SPY through the winter half of the calendar, move to cash through the summer half, one position at full notional, nothing else. The equity curve is a staircase: half a year of ordinary index behaviour, then half a year of a perfectly flat line, repeated. Because one round trip closes per calendar year, the number of trades is essentially the number of years tested.",
      "That structure fixes most of the statistics before any market data arrives. A six-month hold in a broad index finishes higher more often than not, so a high win rate here is a property of the holding period rather than evidence the calendar found anything. Profit factor over so few closed trades is fragile — one bad winter moves it a long way. The figure worth staring at is the drawdown, which is far deeper than the flat summers imply. There is no stop, no take-profit and no maximum holding period, so whatever happens between November and April is taken in full, and the sharpest declines in the tested window landed inside the held months, not the avoided ones.",
      "Cash earns nothing in this model, so the summers contribute exactly zero and the entire case rests on the winters. Read the risk-adjusted number against the headline return — being invested about half the time while still carrying a full-market decline is what holds that ratio down — and treat the same money left invested all year as the real comparison.",
    ],
    honestCaveat: "The sample is the problem. One round trip per year means the whole record rests on a handful of winters, all drawn from a single decade with one dominant regime. Nearly all of the worst decline comes from one event. Any of these statistics would look different if the window started or ended a year earlier or later, and the calendar rule was folklore long before this data existed.",
    editsWorthTrying: [
      { edit: "Run the same thing but stay long SPY all twelve months, and show both curves side by side", why: "Sitting out the summer only means something measured against always being invested, so this is the one comparison that decides whether the calendar rule did anything at all." },
      { edit: "Shift the seasonal boundaries by a month: hold October through April and go to cash May through September", why: "If a one-month shift changes the record materially, the famous November-April boundaries are arbitrary lines rather than something the data supports." },
      { edit: "Add a 20% stop loss to the position", why: "It tests whether the deep in-window decline can be capped, and exposes a quirk of a calendar-only entry rule — the month test is still true after a stop, so the position can go straight back on." },
    ],
    whoItSuits: "Suited to someone testing a famous seasonal claim who wants a simple, low-activity baseline and can sit through a full-index decline while holding; not suited to anyone who wants frequent trading, statistical confidence from a large sample, or any protection during the months they are actually invested.",
  },
  "turtle-breakout": {
    whatTheNumbersMean: [
      "Entry requires a close above the highest high of the prior forty days; the exit fires on a close below the lowest low of the prior twenty. Qualifying takes twice as long as losing the position, and that asymmetry is the design. There is no profit target and no holding limit, so a trade that keeps working is held until the trend breaks its own twenty-day floor. The rule set accepts more losing trades than winning ones; it only adds up if the average winner is a multiple of the average loser.",
      "Ten ETFs soften that shape in both directions. ETFs are baskets already: they trend more smoothly than single names, and they truncate the right tail the design depends on. Six of the ten are the same equity bet in different wrappers, so a twenty-percent position size with a five-position cap can leave the account fully committed to one macro exposure in the week everything breaks out together, then flat again a few months later. GLD, TLT and EEM are the only genuine diversifiers here.",
      "One deviation from the original matters: the two-ATR stop sets risk per trade but not position size, which stays a flat slice of notional. A semiconductor position and a Treasury position therefore carry identical dollars and very different risk. It is long-only as well, so the record contains long stretches holding nothing. Check whether the worst drawdown is genuinely shallower than owning the basket outright, and what the smoother ride cost in return.",
    ],
    honestCaveat: "The ten-ticker list was chosen now, with the last decade already visible — SMH in particular reads like a hindsight pick, and a sector fund that had gone nowhere would not have made the list. The test window is also one long equity uptrend punctuated by fast, V-shaped recoveries, which is forgiving terrain for a long-only breakout rule.",
    editsWorthTrying: [
      { edit: "Size each position by ATR so every trade risks the same dollar amount, instead of a flat 20 percent of notional", why: "This restores the original Turtle sizing and shows whether the volatile members of the basket, SMH and EEM, were driving both the gains and the deepest drawdown." },
      { edit: "Remove the 2-ATR stop and let the 20-day low be the only way out", why: "It reveals how often the volatility stop fires before the channel exit, and whether it is protecting the account or cutting trades that would have recovered." },
      { edit: "Change the entry to a 20-day high so entry and exit use the same lookback", why: "Collapsing the 40/20 asymmetry sharply increases trade count and shows whether the slower entry filter is what keeps the whipsaws tolerable." },
    ],
    whoItSuits: "It suits someone willing to sit through long flat stretches and a steady majority of losing trades in order to stay in the occasional sustained trend; it does not suit anyone who wants frequent activity, a high hit rate, or a rule set that does anything at all while markets fall.",
  },
  "vwap-reversion-15m": {
    whatTheNumbersMean: [
      "This one lost money over the window tested, and the reason sits in the rules rather than the tape. Entry wants price stretched about a third of a percent below the session VWAP with a three-period RSI washed out. The exit is the first close back above VWAP, which caps the winner at roughly the distance you were stretched, while the stop sits a full percent below entry and no take-profit exists beyond that touch. The geometry is lopsided by construction: wins are clipped short, losses are allowed to run several times further. Break-even therefore demands a hit rate well above even, and this rule set did not clear that bar.",
      "The remaining parameters sharpen the same character. A three-period RSI on fifteen-minute bars resets after less than an hour of one-way selling, so the trigger fires constantly - a busy, always-nibbling profile rather than a patient one. SPY and QQQ move together, so two positions at half the account each is closer to one doubled bet than a diversified pair; when the tape slides, both stops tend to go on the same move. And VWAP is recomputed fresh each session, so anything carried past the close has its exit target redrawn near the next open.",
      "Beside this text, read the profit factor before the win rate - for a payoff shaped like this one, the win rate is the least informative figure on the page. Then set the trade count against the date range, and check whether the drawdown arrives in clusters rather than singly.",
    ],
    honestCaveat: "The annualized return is the figure most likely to mislead here. It is computed from a window of weeks rather than years, because the intraday history behind it is short, so a modest percentage loss compounds arithmetically into a dramatic yearly rate. Read the total return and the trade count instead, and treat the annualized number as arithmetic rather than evidence.",
    editsWorthTrying: [
      { edit: "Tighten the stop to about a third of a percent so the downside matches the size of the snap-back the exit is aiming for", why: "It isolates whether the poor result comes from the lopsided payoff geometry or from the entry signal picking genuinely bad moments." },
      { edit: "Require price to be stretched a full percent below VWAP before entering, and relax the RSI threshold", why: "Far fewer but deeper dislocations would show whether the current trigger is firing on ordinary intraday noise rather than real stretch." },
      { edit: "Force every position flat at the session close instead of allowing a one-day hold", why: "Because VWAP resets each morning, trades carried overnight are judged against a brand-new anchor, and this separates that quirk from the rest of the result." },
    ],
    whoItSuits: "It suits a reader who wants to study how stop placement and exit rules determine an outcome on a fast intraday clock; it does not suit anyone looking for a rule set that worked over the window tested, because it did not, or anyone who needs a long sample before taking a result seriously.",
  },
};

export function strategyCopy(id: string): StrategyCopy | undefined {
  return STRATEGY_COPY[id];
}
