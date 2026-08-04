# CHATBACKTEST-BUILD.md — Engineering Implementation Spec

> **What this product is:** Chat·Backtest is a research and education tool for historical trading-strategy simulation. It does not execute trades, does not provide financial advice, does not sell trade recommendations, and displays "past performance does not predict future results" disclaimers on every result. All work in this file builds features for historical research, education, and verifiable record-keeping.

> **How to use this file:** P0 = ship this week. P1 = this month. P2 = this quarter. Execute one item at a time, verify against its acceptance criteria, commit, move to the next. Do P0 top-to-bottom before touching P1.

> **North-star behavior:** strategy deployments to the public forward-test leaderboard (not backtest volume). A deployed strategy gives users a daily reason to return and builds the platform's core asset: a database of timestamped, independently verifiable track records.

---

## CONTEXT (read once, then build)

- The public forward-test leaderboard is the core differentiator. It is currently empty-looking ("day 0/1 of 20" on every entry), which undermines the entire pitch. Fixing it is the highest-impact task in this file.
- The homepage currently displays negative-return templates alongside winners above the fold and leads its FAQ with "Will this make me money? No." Honesty stays — but as supporting texture, not the headline. Winners first, transparency section below the fold.
- The credit system creates purchase anxiety for new users. Move to flat, capability-based tiers (spec in §5).
- Every page currently shares the same `<title>` and meta description. This must be fixed per-page (§4).
- Templates require sign-in before a user feels any value. First backtest must run without an account (§2, P0-3).
- Primary audience for all copy: momentum and swing traders who want to test strategy ideas they encountered online before risking money.

---

## SECTION 1 — METRICS TO INSTRUMENT FIRST

Priority order:
1. **Activation rate** — % of signups who run ≥1 backtest and view a result. Target >60%.
2. **Deployment rate** — % of activated users who deploy ≥1 strategy to the ledger. Target >20%. North star.
3. **D7 / D30 return rate** — segmented by deployed vs. not deployed.
4. **Free→Paid conversion** (30-day window), segmented by activation and deployment.
5. **MRR, ARPU, churn** — including cancel-after-deploy rate (expected near zero).
6. **SEO:** indexed pages, ranking keywords, organic signups.

Events to track: `backtest_run`, `result_viewed`, `ai_message_sent`, `deploy_started`, `deploy_completed`, `signup`, `upgrade_viewed`, `upgrade_completed`, `share_link_created`.

**Acceptance criteria:** every event fires; a simple dashboard computes activation and deployment rate by weekly cohort.

---

## SECTION 2 — P0: SHIP THIS WEEK

### P0-1. Leaderboard must sell on day one
- Replace the empty-state copy ("No deployments have reached the minimum 20 trading days yet") with confident, alive messaging.
- Add a **backtested track record column** next to the forward record so the board is never visually empty. Label clearly: backtest = grey/"hypothetical," forward = green/"verified." Include an icon + text label, never color alone.
- Add countdown framing: "9 strategies live and accruing. First verified 20-day records unlock [date]."
- Default sort: backtested Sharpe descending until forward data exists; add sorting controls.

**Acceptance criteria:** a new visitor never sees an empty board; ≥9 strategies display real stats; a verified/hypothetical legend is visible; a specific return date is shown.

### P0-2. Winners-first homepage
Replace the hero:
- Eyebrow: `The AI strategy lab for momentum & swing traders`
- H1: `Test the setup you saw online — before you risk a dollar.`
- Sub: `Describe any strategy in plain English. Our AI writes the exact rules, backtests 20 years in seconds, and tells you where it breaks. Then prove the survivors on a public, independently verifiable track record.`
- Primary CTA: `Run a backtest free →`  Secondary: `See the live records →`
- Trust line: `Free to start · no card · results in seconds`

Template grid:
- Sort by Sharpe/CAGR descending. Lead with Donchian Breakout, MACD Trend, Golden Cross.
- Move negative-CAGR templates (15-Minute Range Breakout, VWAP Reversion) below the fold into a section titled **"Strategies that failed the test (we leave them up on purpose)"** — this preserves the transparency differentiator without leading with losses.

**Acceptance criteria:** above the fold shows only positive-CAGR flagship strategies; failed strategies live in a clearly labeled transparency section lower on the page; hero names the audience.

### P0-3. Instant, signup-free first backtest
- Any template opens in The Lab and runs one full backtest without an account (rate-limit server-side by IP).
- Gate the *second* action: deploy, save, AI chat beyond N messages, or export → "Create a free account to keep this."
- Replace the "Loading the lab…" cold open with a skeleton state that pre-loads a template so first paint shows a chart, not a spinner.

**Acceptance criteria:** a logged-out user clicks any template and sees a full result in <10s with no signup wall; account prompt appears only at deploy/save/export.

### P0-4. Remove credit anxiety from the free experience (interim)
- Reframe free tier copy from "250 starter credits" to: `Free: unlimited backtests on daily data · full library · 1 live deployment`. Meter quietly on the backend.
- Hide the draining credit counter during a new user's first session; remove per-message cost labels from the first AI conversation.
- Limit-reached copy: "You've hit today's free run limit — Pro removes it." Never "you're out of credits."

**Acceptance criteria:** no visible credit countdown during first backtest + first AI conversation; free value framed as capability, not currency.

### P0-5. Analytics baseline
Implement Section 1 events + dashboard.

---

## SECTION 3 — P1: THIS MONTH

### P1-1. Blog
- `/blog` index → category hubs: `Strategy Tests`, `How-To`, `Behind the Ledger`, `Market Data Deep-Dives`.
- Internal linking rule: every article links to (a) its template page, (b) 2 sibling articles, (c) the leaderboard. Every template page links back to its article.
- First 20 article briefs (title → target keyword):
  1. Does the Golden Cross actually work? We backtested 10 years → *does the golden cross work*
  2. Sell in May and Go Away: does it beat buy-and-hold? → *sell in may backtest*
  3. Buy the Dip: what the data says about 3% pullbacks → *does buying the dip work*
  4. RSI-2 mean reversion: Larry Connors' strategy, tested → *rsi 2 strategy backtest*
  5. The Qullamaggie-style breakout, backtested → *qullamaggie strategy backtest*
  6. Minervini Trend Template: does it hold up? → *minervini trend template backtest*
  7. MACD crossover strategy: 20-year results → *macd strategy backtest*
  8. Donchian channel breakout on megacaps → *donchian breakout strategy*
  9. Turtle Trading rules on modern ETFs → *turtle trading strategy results*
  10. Dual Momentum: does rotation still work? → *dual momentum backtest*
  11. 52-week-high momentum: buying strength, tested → *52 week high strategy*
  12. Bollinger Band reversion, tested → *bollinger band strategy backtest*
  13. VWAP reversion intraday: why it failed our forward test → *vwap strategy backtest*
  14. 15-minute opening range breakout: the full data → *opening range breakout backtest*
  15. Best backtesting software for retail traders (2026) → *best backtesting software*
  16. Composer alternatives after the SoFi acquisition → *composer alternative*
  17. How to backtest a trading strategy without code → *backtest strategy no code*
  18. What is look-ahead bias (and how it inflates backtests) → *look ahead bias backtesting*
  19. Backtest vs forward test: why edges disappear live → *backtest vs forward test*
  20. How to build a verifiable trading track record → *verifiable trading track record*

**Acceptance criteria:** `/blog` live with category hubs; first 6 articles published with internal links; sitemap submitted to Google Search Console.

### P1-2. Per-page SEO
- Homepage: `Chat·Backtest — AI backtesting for momentum & swing traders`
- `/leaderboard`: `Forward-Test Leaderboard — verified live strategy track records`
- `/pricing`: `Pricing — Chat·Backtest AI strategy lab`
- `/library`: `Strategy Library — 14 famous strategies, actually backtested`
- `/playground`: `The Lab — build & backtest any strategy in plain English`
- Template pages: `[Strategy] backtest — 10-year CAGR, drawdown & Sharpe`
- Unique H1 and meta description per page; Open Graph tags site-wide.

**Acceptance criteria:** no two pages share a title or meta description; one H1 per page; OG tags render rich previews.

### P1-3. Shareable record cards
- Every strategy detail page generates a dynamic OG image: strategy name, CAGR, Sharpe, verification hash, watermark.
- "Share this record" button → copies link + downloads a square image sized for social.

**Acceptance criteria:** sharing any strategy URL renders a branded stats card; download-image option exists.

### P1-4. Email sequences
Wire Section 6 with branching off `backtest_run` and `deploy_completed` events. Provider: [DECIDE — Resend or Loops]; owner supplies API key.

### P1-5. Comparison pages
Build `/compare/[competitor]`: Composer (SoFi), TradingView, TrendSpider, QuantConnect, Trade Ideas, NexusTrade. Each page: honest feature table, pricing comparison, a "how the forward-test ledger is different" section, differentiated CTA. Factual and neutral in tone — differences, not disparagement.

**Acceptance criteria:** ≥5 comparison pages live with feature tables and CTAs.

---

## SECTION 4 — PROGRAMMATIC TEMPLATE PAGES

**Route:** `/backtest/[strategy-slug]` — one per template (14 total).

Required sections per page:
1. H1: `[Strategy] backtest: does it actually work?`
2. Live stat block (CAGR, total return, max DD, Sharpe, trades, date range) rendered from the engine, not hardcoded.
3. Plain-English rules (entries/exits/stops/sizing).
4. Equity curve chart with an accessible text/table alternative.
5. "What the numbers mean" — ≥150 words of unique interpretation per strategy (Google's quality bar for programmatic pages requires substantial unique content; the live data + interpretation clears it).
6. Forward-test status linking to its leaderboard entry.
7. "Test a variation" CTA → opens The Lab pre-loaded, instant run, no signup.
8. Internal links: matching blog article + 2 sibling strategies.
9. Standard disclaimer footer (historical simulation, not advice, past ≠ future).

**Acceptance criteria:** 14 pages live; stats render from the engine; CTA opens a pre-loaded Lab run; each page has substantial unique text.

---

## SECTION 5 — PRICING RESTRUCTURE

**Decision:** flat, capability-gated tiers. Retire visible credits from the core experience; keep quiet backend fair-use metering only for genuinely expensive operations (full-universe, intraday, heavy AI). Rationale: prosumer trading tools that win (TradingView, TrendSpider, Trade Ideas) all use flat feature tiers; usage currencies force users to ration before they feel value.

Tiers:
- **Free — $0:** unlimited daily-data backtests, full library, AI chat with invisible fair-use cap, 1 public deployment, watermarked shares.
- **Pro — $39/mo:** everything unlimited on daily + intraday to 1m, up to 100 symbols/run, 10 deployments, private deployments, clean exports (Pine/Python), no watermark.
- **Max — $99/mo:** full US universe + crypto, unlimited deployments, priority engine, verified-record badge + public profile page, early access to upcoming creator tools.
- Annual toggle: save ~2 months.
- Top-up packs remain but de-emphasized (footer-level).

Pricing page hero:
- H1: `Simple pricing. You're paying to build a track record no one can rewrite.`
- Sub: `Free is genuinely usable. Paid unlocks scale, privacy, and tools to make a verified record work for you. Research and education only — never trade recommendations.`

**Owner tasks (not code):** create the $39/$99 products + annual prices in Stripe; hand price IDs to the implementation.

**Acceptance criteria:** pricing page reframed around capability and the verified record; credit counters removed from Free/Pro core flows; annual toggle live; new Stripe price IDs wired.

---

## SECTION 6 — EMAIL SEQUENCES (full copy)

### Onboarding (branching)
**Email 1 — instant on signup — Subject: "Your lab is open. Here's a 4-second win."**
Welcome. One-click button: "Run the Golden Cross backtest →". One line: "Watch 10 years replay in seconds, then ask the AI to change one rule."

**Email 2 — Day 1 if no backtest — Subject: "Did the market break your idea yet?"**
Nudge to first run; link the 3 most popular templates. "Most people start by testing a strategy they saw online. Try it."

**Email 3 — Day 2 if backtest but no deploy — Subject: "A backtest is a guess. Here's how you prove it."**
Three lines on the ledger: "Deploy one strategy. Every trading day it scores itself on fresh data nobody had when you built it. That's a track record you can actually show someone." CTA: "Deploy your first strategy →"

**Email 4 — Day 4 if deployed — Subject: "Your record is live. Here's your shareable card."**
Link their strategy card + image download. "When it wins, you called it in public — timestamped and verifiable."

**Email 5 — Day 7 if active but free — Subject: "You've tested [N] strategies. Time to go deeper?"**
What Pro unlocks (intraday, private, exports, more deployments). Soft CTA. Close with: "No pressure — free stays genuinely usable."

**Email 6 — Day 14 if ≥1 deploy + high usage — Subject: "Serious traders keep receipts."**
Connect a verified record to real outcomes (evaluations, audience trust, job applications). Max CTA.

### Win-back
**W1 — 14 days inactive — Subject: "Your strategies are still scoring without you."**
"While you were away, [strategy] moved to [rank]. Your record is still accruing." Link leaderboard.
**W2 — 30 days — Subject: "One result before you go."**
A new template or notable recent result. Single CTA to The Lab.
**W3 — 45 days — Subject: "We'll keep your track record safe."**
Reassure the record persists; invite back; final touch.

**Acceptance criteria:** all 9 emails implemented with correct triggers; subject lines A/B-testable.

---

## SECTION 7 — DESIGN / UX / ACCESSIBILITY

### UX fixes
- The Lab: skeleton + pre-loaded template on first paint (see P0-3); surface the "Try one of these" AI prompts prominently.
- Lab empty state: "Pick a template on the left and hit Run backtest — or paste a strategy you saw online and let the AI build it."
- Error state (unparseable strategy): "The AI couldn't turn that into testable rules yet. Try naming an entry, an exit, and what you're trading."
- Deploy confirmation: "This freezes your strategy permanently. From today it scores itself on fresh data — win or lose, it's on the record. That's the point."
- Homepage: add a live strip near the top showing the current top leaderboard strategy.

### Accessibility (WCAG 2.1 AA checklist)
- [ ] Text contrast ≥4.5:1 (audit grey stat labels and the theme toggle).
- [ ] All interactive elements keyboard-reachable with visible focus rings.
- [ ] Touch targets ≥44×44px on mobile.
- [ ] Charts have text/table alternatives for screen readers.
- [ ] Color never the only signal (verified/hypothetical, gain/loss = icon + text too).
- [ ] Alt text on all images and generated cards.
- [ ] Labeled form inputs.

**Acceptance criteria:** axe/Lighthouse scan shows no critical issues; keyboard-only pass completes the full run-a-backtest flow.

### Design system
- Tokens: one accent (verified green), one danger (loss red), neutral grey scale; spacing scale 4/8/12/16/24/32; one heading font, one body font.
- One reusable stat-block component (CAGR/Return/DD/Sharpe) used identically on homepage, library, template pages, leaderboard.
- One button component (primary/secondary/ghost); remove one-off link styles.

**Acceptance criteria:** stat displays render from one component; no ad-hoc hex values in new code.

---

## SECTION 8 — ADDITIONAL FEATURES (P1/P2)

- **Creator embed widget:** iframe/script showing a user's live verified ledger record for embedding on their own site or link-in-bio. Watermarked, links back.
- **Referral mechanic:** "Give a friend 1 extra deployment slot, get 1." Denominated in deployments, reinforcing the core behavior.
- **One-click famous-strategy deploy:** any library template can be deployed to the public ledger in one click, generating a shareable record card.
- **Waitlist button (Phase 2 interest test):** on the leaderboard, add a clearly labeled "Coming soon: follow top strategies" button that opens a waitlist signup. Honest coming-soon framing; measures demand before any build.

---

## SECTION 9 — PHASE 2 GROUNDWORK (schema now, features later)

- Add columns to the deployed-strategy model now, shipped null/unused: `creator_id`, `visibility` (public/private), `follower_count`, `subscription_price`, `terms`.
- Store daily forward returns as immutable rows keyed by `(strategy_hash, date)` so records can be independently audited later.
- Keep a strict separation between "ledger event recorded" (what the platform does) and "trade executed" (which never happens on the platform). Preserve this boundary in all schema and API design.

### Compliance requirements (apply to all copy and features)
- Keep the research/education framing verbatim on every results surface: historical simulation, not financial advice, past performance does not predict future results.
- Keep existing survivorship-bias and slippage disclosures on results.
- Describe all features accurately as historical research, education, and track-record verification. Never describe or market anything as trade recommendations or advice — because that is not what the product does.
- Before building any feature where users charge followers (Phase 2), the owner consults a securities attorney on structure. That decision gates the build; do not implement follower-payment features until it's made.

---

## SECTION 10 — OWNER DECISIONS REQUIRED (blockers)

1. Email provider (Resend or Loops) + API key — blocks §6.
2. Analytics tool (PostHog recommended) + key — blocks P0-5.
3. Stripe: create $39/$99 products + annual prices — blocks §5 wiring.
4. Launch date for "first verified records unlock" countdown — blocks P0-1 copy.
