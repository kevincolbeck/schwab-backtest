# Phase 0 — Design Audit (pre-redesign snapshot)

Audited: every route under `web/src/app/` + every component under `web/src/components/` + `globals.css`, as of 2026-08-03. No code was changed in this phase.

Verdict in one line: the token layer (`globals.css`) is genuinely good and mostly consumed, but **half the site bypasses the component kit** — hand-rolled buttons/cards/tables in four different radius and padding dialects — and the homepage stacks every ambient effect at once while dumping all 14 templates into one wall.

---

## 1. Site-wide inconsistencies (the systemic ones)

### 1.1 Buttons — four dialects for the same primary action
`ui/Button.tsx` exists (primary/outline/ghost/danger, sm/md/lg) but only /playground, ChatPanel, AuthModal, and LivePreview use it. Everywhere else the primary CTA is hand-rolled, each slightly differently:

| Location | Classes | Radius |
|---|---|---|
| Button md (the kit) | `px-4 py-2 rounded-[10px]` | 10px |
| Home hero CTA (page.tsx:106) | `rounded-xl bg-accent px-5 py-2.5` + gloss-ring | 12px |
| Home final CTA (page.tsx:353) | `rounded-xl px-6 py-3` | 12px |
| Markets CTA (markets/page.tsx:321) | `rounded-md bg-accent px-4 py-2 hover:opacity-90` | 6px |
| Strategy fork (strategy/[slug]/page.tsx:118) | `rounded-md bg-accent px-4 py-2` | 6px |
| Share fork (s/[slug]/page.tsx:75) | `rounded-md bg-accent px-5 py-2.5` | 6px |
| Runs fork (runs/[runId]/page.tsx:47) | `rounded-md bg-accent px-4 py-2` | 6px |
| Pricing upgrade (pricing/page.tsx:114) | `rounded-md bg-accent px-4 py-2` | 6px |
| Pricing packs (pricing/page.tsx:141) | `rounded-[10px] border` | 10px |
| Account/Portal/SignOut (account, dashboard) | `rounded-md` | 6px |
| Login OAuth + email (login/page.tsx:96,120) | `rounded-md` | 6px |
| NavAuthButton dashboard link | `rounded-[10px] border` | 10px |

Hover is equally split: `hover:bg-accent-hover` (kit) vs `hover:opacity-90` (all hand-rolled accents) vs `hover:bg-panel-2` vs `hover:border-accent`. Phase 2 fix: one Button (+ link-styled variant) consumed everywhere; delete every hand-rolled instance above.

### 1.2 Cards — two competing card systems
- `.card` (globals.css:114): `bg-1` + hairline + **14px** radius + `--shadow-card`. Used on home, playground, docs cards, ChatPanel.
- Hand-rolled `rounded-xl border border-hairline bg-panel` (**12px, no shadow**): TemplateCard, LibraryCard, pricing tiers, markets MoverList/empty states, strategy/[slug] panels (5×), leaderboard warming-up cards, dashboard list containers, account `<dl>`, TradeTable wrapper (`rounded-lg`, 8px), runs page (`rounded-lg`), s/[slug] hero (`rounded-2xl`, 16px).

Same content type (a stat panel) gets 8, 12, 14, or 16px radius depending on which page you're on. Phase 1: one radius token pair, `.card` (or a Card component) everywhere.

### 1.3 Page shell — five container widths, three vertical rhythms, two eyebrow styles
- Widths: `max-w-6xl` (home, markets, docs shell), `max-w-5xl` (library, leaderboard, pricing, dashboard, strategy), `max-w-4xl` (runs, s/), `max-w-3xl` (home FAQ), `max-w-lg` (account), `max-w-sm` (login).
- Padding: `py-16` (pricing, account, login, home sections), `py-12` (library, markets, leaderboard, dashboard), `py-10` (docs, strategy, runs), `py-20` (home final CTA). Section gaps `mt-10` vs `mt-12` vs `mt-8`.
- Eyebrow labels: home uses `text-[11px] uppercase tracking-widest text-accent`; library/markets/leaderboard/strategy/s use `text-xs …`; docs cards add `font-semibold`; playground gate uses `text-[11px]`. Same pattern, three sizes/weights.
- H1s: `text-4xl/5xl` (home), `text-3xl` (library/markets/leaderboard/pricing), `text-2xl` (strategy, dashboard, account, login, s/), `text-xl` (runs). Pricing and dashboard have no eyebrow at all.
- Section headings flip between display style (`text-2xl font-semibold tracking-tight`, home) and label style (`text-sm font-semibold uppercase tracking-wide`, library/markets/dashboard) with no rule for which is which.

The brief's section-shell component solves all of this — build it first.

### 1.4 Tables — three conventions
- Leaderboard: `text-sm`, `px-4 py-3` cells.
- Markets earnings: `text-sm`, `px-3 py-2.5` head / `px-3 py-2` body.
- Strategy signals + TradeTable: `text-xs`, `px-3 py-2` / `px-3 py-1.5`.
One evidence-table component (mono numerals, right-aligned numeric columns, consistent density) should replace all four.

### 1.5 Focus states — `.focus-ring` exists but coverage is patchy
Missing (keyboard users get browser default or nothing): pricing upgrade/pack buttons, PortalButton, SignOutButton, dashboard links, markets CTA, strategy/runs/s fork links, login OAuth buttons + email button, TradeTable "Show more". Leaderboard links hand-roll `focus-visible:ring-2` inline instead of the class. Phase 2: focus-ring is baked into Button/Link primitives, not sprinkled.

### 1.6 Type scale — off-scale micro sizes everywhere
`text-[9px]`, `text-[10px]`, `text-[11px]` appear ~70 times (full list in §6.2). Three unnamed sizes below `text-xs` with no rule for which means what (label vs caption vs legal). Phase 1 must define named steps (e.g. `--text-caption`, `--text-label`) and collapse these.

### 1.7 Ad-hoc glyph language
Literal characters doing UI work, each a one-off: `▸` active template marker (playground:849,874), `●` active chip (playground:1015), `◈` credit icon (playground:782), `ⓘ` stat hints (StatTiles:137), `✓` pricing checks (pricing:105), `↓` export buttons (playground:614,624,627), `☀/☾` theme toggle, `✕` modal close, bare `⌘K` text span in nav (SiteNav:38). Phase 2: a tiny consistent icon treatment (or one deliberate glyph set), styled `<kbd>` for shortcuts.

---

## 2. Per-page notes

### Home (`app/page.tsx`)
- **Template wall: all 14 templates** rendered in a `sm:grid-cols-2 lg:grid-cols-4` grid (line 267) — the canonical offense. 14 cards × 5 data points each ≈ 70 numbers in one section. Brief: 6 curated in 3×2 + "Explore all N →".
- `aurora` div repeated on **5 sections** (hero, strategist, ledger teaser, templates, final CTA — lines 84, 146, 201, 252, 344). Each aurora spawns two 32–38rem `blur(72px)` animated blobs → up to 10 blurred compositing layers on one page. The ambient effect stops being ambient when it's everywhere; keep it in the hero only (or make it a fixed page-level backdrop).
- Hero stacks four effects at once: aurora + `hero-grid` + always-on `gloss-ring` on the CTA + `btn-glow` + gradient text. Chanel rule violation; pick the ring and the glow, drop the rest or make them near-invisible.
- **Two idle-animating gloss rings in the same viewport**: hero CTA (line 106, `gloss-ring`) and LivePreview wrapper (LivePreview.tsx:41, `gloss-ring`) both idle-spin at 7s. Brief: only ONE idle ring per viewport, 8s+. Final CTA correctly uses `gloss-ring-hover`.
- Hero is `lg:grid-cols-2` with the LivePreview — good bones, keep.
- Pillars/strategist/honesty sections are 3-card grids with distinct in-card type treatments (pillars: `text-lg font-semibold` title; strategist: `text-sm font-semibold`; honesty: `text-sm font-medium` + `text-xs` body). Same card, three internal scales.
- FAQ uses native `<details>` — no animation, default marker, `marker:text-faint` only on summary. Fine functionally; Phase 2 accordion should restyle without breaking semantics.
- Ledger teaser rows are solid evidence-styling groundwork (rank, days live, sparkline, signed %).

### Playground (`app/playground/page.tsx`)
- The strongest page structurally (three-zone terminal, toolbar, tabs) and the most kit-compliant (Button, Tabs everywhere).
- Left rail lists all 14 templates as a flat unlabeled stack (no category grouping) — mild overwhelm; group by category or add search when Phase 3 touches it.
- Toolbar controls (date inputs, selects, credit chip, dashboard link) each hand-roll `rounded-[10px] border border-hairline bg-panel px-2…` with small variations — should be one Input/Control primitive.
- Layout magic numbers: chat dock `h-[calc(100vh-140px)]`, `lg:top-[104px]`, `w-[340px]`, `xl:w-[380px]`, mobile chat `h-[420px]`, empty states `min-h-[380px]`/`min-h-[200px]` (lines 1041–1114). These encode nav (48px) + toolbar heights — brittle; tokenize.
- Empty/gate states use `.card border-dashed` — nice pattern, keep.
- **Race-guard logic is inviolable** (see §5).

### Library (`app/library/page.tsx`)
- `LibraryCard` (lines 61–136) is a near-duplicate of `TemplateCard` with 4 extra data points (timeframe badge, Sharpe, trades, date range) — two components drifting apart for the same object. Merge into one template card per the brief's redesign (name, one-liner, ONE hero number, sparkline, category tag).
- Category grouping (Trend/Momentum/…) with taglines is good progressive structure — keeps any single view ≤ ~5 cards. Brief asks for filter chips on top of this.
- Cards show 7 numbers each; the redesigned card shows 1 + sparkline.
- No sparkline on cards today despite `Sparkline` existing.

### Markets (`app/markets/page.tsx`)
- **Sector heatmap renders every cached symbol tile across ~11 sector groups — easily 100+ tiles at once** (lines 170–191). Second-worst overwhelm point after the template wall. Needs progressive disclosure (top N per sector + expand, or a compact treemap).
- `tileStyle()` uses `color-mix` with gain/loss tokens — correct token usage, documented P&L-semantics exception. Keep the approach.
- Earnings table + IPO list follow their own table/list styles (§1.4).
- Bottom CTA card is `rounded-xl` + `rounded-md` button — off-kit both ways.

### Leaderboard (`app/leaderboard/page.tsx`)
- THE brand page per the brief, currently a plain table. The append-only ledger doesn't *look* append-only: `deployed_at` timestamps and sparkline exist, but no spec-hash fragments on rows (the strategy detail page has them), no entry animation, no mono verification marks.
- 8 columns is dense but appropriate for the evidence surface; mobile relies on horizontal scroll of the whole table.
- Row metadata (avatar, House badge, timeframe chip, days badge) is a good start on identity; badges hand-roll `rounded-full border px-1.5 text-[10px]` five separate times (lines 132–148, 211–226) — needs a Chip primitive.
- Warming-up section is honest and good — keep the "day N of M" framing.

### Pricing (`app/pricing/page.tsx`)
- No eyebrow, no section shell; tiers are hand-rolled 12px cards; upgrade buttons `rounded-md` (§1.1); check glyph `✓` colored accent (accent used decoratively — brief reserves accent for actions/states).
- Featured tier styling (`border-accent/60 bg-accent-soft` on Pro) is a reasonable emphasis mechanic, keep the idea.
- Copy is compliance-deliberate ("never better signals") — do not touch.

### Docs (`app/docs/*`)
- The cleanest subsystem: semantic HTML + `.docs-prose` + Callout/Steps/FooterNav, all token-derived. Only 11 utility-class occurrences across 10 content pages. Treat as the reference for how the rest should consume the system.
- Docs cards on the intro page use `.card` + `gloss-ring-hover` correctly.
- Callout `warn` kind borrows `--gloss-warm` (a gloss-ring internal) as its amber — works, but Phase 1 should promote a real `--warn` semantic token instead of aliasing an effect color.

### Strategy detail (`app/strategy/[slug]/page.tsx`)
- Best existing "evidence" page: spec-hash chip (line 100), append-only signals table, side-by-side backtest vs forward panels (never merged — preserve). All panels hand-rolled 12px cards; fork CTA `rounded-md`; eyebrow `text-xs` variant.
- Forward panel uses `border-accent/40` for emphasis — fine mechanic, tokenize the alpha variants (`accent/30`, `/40`, `/50`, `/60` all appear across the site — pick two).

### Share (`app/s/[slug]/page.tsx`) & Run (`app/runs/[runId]/page.tsx`)
- s/: `rounded-2xl` hero card (only 16px card on the site), `rounded-md` fork CTA, `rounded-lg` details. Copy says "Free, no login" (line 79) — flag: V2 gates the lab behind login; copy meaning is product truth, confirm with Kevin before Phase 3 re-sets this line, don't silently change it.
- runs/: `rounded-lg` cards, `rounded-md` CTA, `text-xl` h1 (smallest page title on the site), no eyebrow.

### Login (`app/login/page.tsx`), Account, Dashboard
- Login duplicates AuthModal's provider list + email flow with *different* primitives (`rounded-md` vs Button/`rounded-[10px]`; input without `.focus-ring`). Two sign-in surfaces, two styles. Copy still says "No password — we email you a magic link" while OAuth buttons sit above it — copy/layout mismatch to re-set (not reword) in Phase 3.
- Account/dashboard: bare `rounded-md` buttons, no eyebrow, dashboard mixes `text-sm font-medium uppercase` section labels. Both are thin pages that will fall out of the section shell almost for free.

### Nav (`SiteNav.tsx`) & footer (`layout.tsx`)
- Nav: sticky + glass + hairline — right recipe. `h-12` (48px) is cramped for the brand + 6 links + 3 controls; brief wants hairline that appears on scroll (currently always-on). `⌘K` is an unstyled faint span, not a `<kbd>`.
- No mobile menu at all: below `sm`, the 6 nav links simply vanish (`hidden sm:flex`, line 26) — mobile users can only navigate via footer/⌘K. Must-fix in Phase 2 (brief: "Mobile menu equally polished").
- Footer is 3 links + disclaimer; per-brief needs the full component treatment.

---

## 3. Overwhelm points (ranked)

1. **Homepage template wall — all 14 templates, 4-wide, ~70 data points** (page.tsx:266–273). Brief mandates: 6 curated (3×2), incl. ≥1 negative-return template, + "Explore all N strategies →" ghost button.
2. **Markets sector heatmap — 100+ symbol tiles at once** (markets/page.tsx:170–191).
3. **StatTiles — 8 metric tiles with hint buttons after every run** (StatTiles.tsx:119). Consider 4 hero stats + "more" disclosure; the tiles themselves (mono number, whispering label, delta valence) are already the evidence pattern — keep the design, gate the count.
4. Playground left rail — 14 ungrouped template buttons + scratch (playground:833–881).
5. Homepage section count — 8 full sections with 5 aurora backdrops; the strategist section alone is heading + 3 cards + trailing paragraph + link.
6. LibraryCard — 7 numbers per card × up to 5 per category (bounded by grouping, but the card itself over-shares).
7. Leaderboard row metadata — up to 6 chips/labels per strategy cell.

## 4. Dead weight (serves nothing — cut or consolidate)

- 4 of 5 homepage `aurora` instances (keep hero only). The per-section `hero-grid` mask is hero-only already — good.
- Second idle gloss ring in the hero viewport (LivePreview *or* CTA idles — not both; brief says only the hero CTA may idle, ≥8s; current spin is 7s).
- ChatPanel `animate-ping` pulsing dot (ChatPanel.tsx:47) — a permanent decorative pulse implying "live" where nothing is streaming. Brief: decoration pretending to be data is forbidden.
- `opacity-0 group-hover:opacity-100` "Fork it →"/"Open →" reveals (TemplateCard:50, LibraryCard:121,129) — invisible on touch, adds nothing on desktop; the whole card is already the link.
- Duplicate LibraryCard vs TemplateCard (§2 Library).
- Login page duplicating AuthModal (§2 Login) — one auth surface, used by both.
- `btn-glow` + `gloss-ring` + `bg-accent` triple-treatment on the hero CTA — ring OR glow.
- `UTCTimestamp` re-export "kept for future" (CandleChart.tsx:162) — harmless, but it's the only speculative export in the kit.

## 5. What already works — preserve through the redesign

- **LivePreview** (landing/LivePreview.tsx): real baked Golden Cross run, real stats, interactive crosshair, fullscreen→auth gate. The hero proof object. Re-skin only.
- **EquityChart** dual-curve (current vs ghost previous) + drawdown sub-panel — Kevin explicitly likes these; restyle via tokens, do not replace (CLAUDE.md Phase A).
- **StatTiles** delta system: valence-correct coloring (▲ on Max DD = worse), "better/worse" words for WCAG 1.4.1, aria-labels, plain-English hints on every metric. Keep all of it.
- **Honest-FAQ + honesty section + DISCLAIMER** on every results surface (playground:976, library:181, markets:327, leaderboard:235, strategy:265–272, s/:69, runs:68, docs layout:24, footer). Copy meaning is compliance-locked.
- **All playground race-guard logic** (playground/page.tsx): `genRef` generation counter invalidating in-flight runs/chat (275, 342, 368, 427), `runRef` stale-closure guard (166–173), `staleTemplateParam` scratch-mode URL guard (169–171, 233–247), bars-cache-per-run invalidation (127–133, 281), `notComparable` date/timeframe comparison suppression (289–336), 402 credit-balance sync (313–315, 450–452), re-click no-op on active template (339), aiEnglish loading-unwedge comment (548–551), intraday date clamp (398–411). A visual rebuild must not restructure this state machine.
- **Evidence details already shipped**: spec-hash chip (strategy:100–105), append-only signals table + framing copy, forward/backtest never merged, "since {date}" stamps, `.tnum` mono figures site-wide. Brief §3.1 extends this language; the truth-encoding is already here.
- **A11y infrastructure**: Modal focus trap + scroll lock + focus return, Tabs roving focus + ARIA, TradeTable keyboard rows, `role=log aria-live` chat, reduced-motion guards on gloss/aurora/Reveal/ping/bounce, sr-only h1 on playground.
- **Reveal** scroll system (14px fade-up, once, reduced-motion aware) — matches the brief's spec almost exactly (brief: 16px/500ms/60ms stagger); normalize the numbers, keep the component.
- Theme no-flash `THEME_INIT` script; `⌘K` CommandPalette; `slim-scroll`; `tileStyle` color-mix technique.

## 6. Light/dark state

- Toggle **exists** (ThemeToggle in nav), default dark, persisted `localStorage["ctb-theme"]`, pre-hydration inline script prevents flash.
- **Light IS token-derived**: `[data-theme="light"]` (globals.css:36–63) overrides the complete custom-property set — including AA-adjusted `--gain`/`--loss`/`--faint` and dimmed gloss/aurora. Per the brief's rule ("keep light only if derived automatically from tokens"), light qualifies to survive — with these gaps to close in Phase 1:
  - **Charts ignore the theme.** EquityChart hardcodes 5 dark hexes + a dark tooltip panel `#161c28`; Sparkline hardcodes gain/loss; CandleChart hardcodes GAIN/LOSS/ACCENT (it *does* read `--muted`/`--hairline` and re-skins on theme flip via MutationObserver — extend that pattern to all chart colors). In light mode today: dark-tuned `#089981` instead of AA `#067a67`, `#8a94a6` axis text on white, dark tooltip box.
  - Modal + CommandPalette overlays hardcode `bg-black/60`/`bg-black/50` (raw black, not a token; visually fine both themes but off-system).
  - OG image hardcodes the dark token values — acceptable (OG can't read CSS; social cards commit to dark) but the constants must mirror tokens.css and be commented as such.

## 7. Hardcoded hex/size inventory — Phase 1 work list

### 7.1 Hex colors outside the token sheet (file:line)

| File:line | Value | Disposition |
|---|---|---|
| components/EquityChart.tsx:18 | `#8b7cf6` ACCENT | → read `--accent` (CSS-var read or token module) |
| components/EquityChart.tsx:19 | `#3fa98e` PREV | → `--prev-run` |
| components/EquityChart.tsx:20 | `#f23645` LOSS | → `--loss` |
| components/EquityChart.tsx:21 | `rgba(148,163,184,0.12)` HAIRLINE | → `--hairline` |
| components/EquityChart.tsx:22 | `#8a94a6` MUTED | → `--muted` |
| components/EquityChart.tsx:194 | `#161c28` tooltip bg | → `--bg-2` (or shared tooltip component) |
| components/CandleChart.tsx:30–32 | `#089981` / `#f23645` / `#8b7cf6` | → `--gain`/`--loss`/`--accent` via existing `readTokens()` |
| components/CandleChart.tsx:37–38 | `#8a94a6`, `rgba(148,163,184,0.1)` fallbacks | fallbacks only — keep, but derive from one constants module |
| components/Sparkline.tsx:26 | `#089981` / `#f23645` | server component — needs `currentColor`/CSS-var approach (`stroke="var(--gain)"` works in inline SVG) |
| app/strategy/[slug]/opengraph-image.tsx:12–19,55 | 8 dark token values + gradient rgba | acceptable (OG renders off-DOM) — must mirror tokens, comment the linkage |
| components/ProviderLogo.tsx:15–37 | Google ×4, Discord blurple | legit brand-mark exception — document in SYSTEM.md |
| components/ui/Modal.tsx:80 | `bg-black/60` overlay | → overlay token |
| components/CommandPalette.tsx:72 | `bg-black/50` overlay | → same overlay token |

globals.css:8–63 is the token sheet itself (fine; Phase 1 relocates to `styles/tokens.css`); :175/:177 `#000` are mask plumbing, not color.

### 7.2 Off-scale/arbitrary sizes (work list for the type + spacing scale)

Micro-type (`text-[9px]`/`text-[10px]`/`text-[11px]`) — collapse to named caption/label steps:
- app/page.tsx:117,133,149,204,255,286
- app/playground/page.tsx:69,78,633,654,658,666,674,678,705,829,852,877,928,957,976,988,1035,1069
- app/leaderboard/page.tsx:112,124(9px!),132,139,146,208,211,218,226,235
- app/library/page.tsx:76,82,94,100,110,114,165,181
- app/markets/page.tsx:123,185,292,297,327
- app/strategy/[slug]/page.tsx:135,139,143,147,162,168,172,176
- app/docs/page.tsx:81 · app/docs/layout.tsx:24 · app/account/page.tsx:31,35 · app/login/page.tsx:102 · app/s/[slug]/page.tsx:47,69 · app/runs/[runId]/page.tsx:68 · app/layout.tsx:58
- components: StatTiles:128 · TemplateCard:15,25,31,35,45 · Sparkline:15 · TradeInspector:58,64,70,77,94 · SiteNav:38 · Tabs:68 · ShareToX:— · CommandPalette:89,105,115,123 · Button:— · LivePreview:46,58 · ChatPanel:52,65,137 · EquityChart:179 · AuthModal:94,123 · DocsSidebar:84 · DocsBits:51,109,124

Arbitrary radii (`rounded-[10px]`/`rounded-[14px]`) — fold into `--radius-control`/`--radius-card` utilities:
- ui/Button.tsx:17 · NavAuthButton:13 · ShareToX:75 · AuthModal:113 · pricing:141 · LivePreview:41 · playground:726,748,758,767,780,800

Layout magic numbers:
- playground:1100 `h-[calc(100vh-140px)]`, `lg:top-[104px]`, `w-[340px]`, `xl:w-[380px]` · playground:1114 `h-[420px]` · playground:1041,1054,1084 `min-h-[200px]`/`min-h-[380px]` · CommandPalette:66 `pt-[18vh]` · docs/layout.tsx:18 `max-h-[calc(100vh-6rem)]` · docs/layout.tsx:23–24 `max-w-[70ch]` (fine — line-length is a legit ch value; name it) · DocsBits:80 `left-[13px]`
- Chart pixel constants (props/defaults, acceptable but should come from one place): EquityChart height 320/72, Sparkline 120×28, CandleChart 340, LivePreview chart 230, strategy page 260, s/ 280, TradeInspector 340, playground chart 420.
- Non-token alpha variants scattered: `border-accent/30,/40,/50,/60`, `bg-accent/…`, `text-accent` on borders — standardize to two named alpha steps.

### 7.3 Motion values outside any token
- gloss-spin 7s (globals.css:182) — brief: idle ≥8s, hover-only elsewhere.
- aurora drift 44s/56s (globals.css:227,234).
- Reveal: 0.45s / y14 / 0.06 stagger / custom bezier (Reveal.tsx:23) vs brief's 500ms/16px/60ms — unify as motion tokens.
- transition durations: `duration-150` (Button, ShareToX, Tabs) vs unspecified `transition-colors` defaults elsewhere; `transition: opacity 0.2s` (gloss ring).

---

## 8. Screenshots

Not captured in this pass — no running dev server/browser in the audit environment. Phase 3/QA must do the visual self-critique pass (brief §7) against localhost.
