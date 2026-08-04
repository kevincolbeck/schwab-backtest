# SYSTEM.md — Chat·Backtest Design System (Phase 1)

Single source of truth: `web/src/styles/tokens.css` (all raw values) + the Tailwind
`@theme` mapping in `web/src/app/globals.css` (utility names). Components and pages
consume tokens only — a hex value outside tokens.css is a defect (exceptions in §9).
Dark is the source theme; `[data-theme="light"]` is a pure token override set.

The brand in one line: **they sell the dream, we sell the proof.** Every visual
decision below serves that — cold, precise, instrument-like, with numbers as heroes.

---

## 1. The accent: ice blue — and why

`--accent: #4da2ff` (dark) / `#1670d6` (light) · partner `--accent-2: #3edbf0` glacial cyan.

Brief constraints: not LuxAlgo's look, not the Linear-purple clone (this retires the
old violet `#8b7cf6` — this WAS an accent migration), not green (reserved for profit).
Candidates were electric cyan, cold amber, ice blue. Ice blue wins:

- **Semantics stay clean.** Cold amber would collide with the warning semantic; pure
  electric cyan sits too close to the teal-leaning gain green `#089981` — an active
  state could read as "profit." Ice blue (hue ~212°) is unambiguous next to gain
  (~165°), loss red, and warn amber.
- **CVD-safest choice.** Blue survives every common color-vision deficiency; blue vs
  amber/red/teal are the strongest distinguishable pairings we could pick.
- **It reads "instrument."** Cold, precise, HD — Mercury-class fintech trust rather
  than Linear-clone SaaS or LuxAlgo mystique. With the glacial-cyan partner, the
  hero sweep feels like ice and glass: a research instrument, not a dream machine.
  (The gloss ring is the ONE sanctioned full-spectrum exception — §5.)
- **Contrast works both ways:** 6.6:1 as text/links on the canvas; dark canvas ink on
  an accent-filled button clears 6:1. Light variants tuned to ≥4.5:1 on white.

`--accent-2` is the **gradient partner only**. It exists in exactly one place: the
single hero gradient sweep (plus its aurora wash `--aurora-2`). It left the ring when
the ring went full-spectrum (owner directive — §5). Never text, never fills,
never charts, never a third brand color.

### Accent restraint rules

Accent MAY appear on: the primary CTA (one per page), links, active/selected states,
focus rings, the gloss-ring material, small "live/selected" markers.
Accent MUST NOT appear on: decorative icons or checkmarks (pricing ✓ was the offense —
use `--muted`), large fills or washes, borders of resting cards, body text, anything
that isn't interactive or active. If a viewport shows accent in more than ~3 places,
remove some. Where the accent does NOT appear is what makes it work.
Alpha emphasis: exactly two named steps — `--accent-soft` (fills) and raw accent at
1px (borders/rings). The scattered `/30 /40 /50 /60` variants collapse to these.

## 2. Color roles (complete)

| Token | Role | Never |
|---|---|---|
| `--bg-0` | canvas (near-black `#0c0f14`) | pure black |
| `--bg-1` / `--bg-2` | elevation 1 (cards) / 2 (nested panels, tooltips) | stacking >2 elevations |
| `--bg-3` | control/hover fill | using as a card surface |
| `--hairline` / `--hairline-strong` | THE border (1px) / emphasis+focus borders | 2px+ borders, colored borders on resting surfaces |
| `--ink` / `--muted` / `--faint` | text 92% / 60% / ~42% | `--faint` for content that must be read (marks, timestamps, legal only) |
| `--accent` (+hover/soft/glow) | §1 | decoration |
| `--accent-2` | gradient partner material | anything else |
| `--gain` / `--loss` (+softs) | P&L, deltas, candle valence ONLY | buttons, links, decoration, "success/error" UI states |
| `--warn` (+soft) | cautions, warn callouts, degraded states | charts (could read as P&L), decoration |
| `--prev-run` | previous-run chart overlays + their legend chips | text, badges, anything outside comparison charts |
| `--overlay` | modal/palette scrim | tinting content |

Notes:
- **gain/loss retained** (`#089981`/`#f23645`, TradingView pair): 5.3:1 / 4.9:1 on the
  new canvas; the teal-leaning green keeps the pair CVD-distinguishable. Light theme
  swaps AA-adjusted `#067a67`/`#d1202f`. Valence is never encoded by color alone —
  keep the existing arrows + "better/worse" words (StatTiles pattern).
- **`--prev-run` `#37b7ce`** (deep glacial cyan): the ghost of the current run — same
  cold family as the accent, one step greener and dimmer so it recedes. Because
  current-vs-previous are hue-adjacent, the ghost curve MUST also differ by weight or
  dash and carry a legend label — color is never the only cue.
- **`--gloss-warm` is deprecated** — now an alias of `--warn` kept only for the docs
  warn-Callout; Phase 2 re-points that to `--warn` and deletes the alias. The ring no
  longer has a warm stop.

## 3. Evidence language (the signature)

Numbers are the brand. Rules:

- **Every number is mono + tabular**: `.tnum` (Geist Mono, `tabular-nums`) on every
  stat, %, $, count, timestamp, and hash — no exceptions, including marketing copy.
- **The number is the hero, the label whispers**: value in `--ink` at the larger
  step, label in `--muted` at `text-caption`/`text-xs`, unit as a small suffix.
- **Hash fragments**: truncated middle (`a3f9…c21e`), `--faint`, `text-caption` mono,
  optionally followed by a `✓` in `--muted` (not accent, not gain). Hashes appear on
  ledger rows, strategy pages, leaderboard entries.
- **Timestamps**: real ISO-ish dates in mono `--faint`; "since 2026-03-14" framing.
- **Verified/frozen badge**: hairline pill (`--radius-pill`), `--bg-2` fill, mono
  caption text `--muted`, tiny `✓` — quiet, never glowing, never accent.
- **Truth rule (absolute)**: every timestamp, hash, and stat rendered must be real
  data from the system. Decoration pretending to be data is forbidden — one faked
  number undermines the entire brand. (This killed the ChatPanel `animate-ping`
  "live" dot: nothing was live.)
- Ambient instrumentation texture (`.hero-grid` dotted grid) is allowed in the hero
  only, at hairline opacity — barely perceptible.

## 4. Typography

Geist (display + body), Geist Mono (all numbers/code/hashes) — via
`--font-stack-sans` / `--font-stack-mono`.

- **Weight discipline**: 400/500 body, 500/600 display. Never 700+. Hierarchy comes
  from size, spacing, and tier color — not boldness.
- Scale (tokens → utilities): `--type-caption` 11px (`text-caption`) · label 12
  (`text-xs`) · body-sm 14 (`text-sm`) · prose 15 (docs only) · body 16
  (`text-base`) · body-lg 18 (`text-lg`) · title-sm 20 (`text-xl`) · title 24
  (`text-title`) · headline 32 (`text-headline`) · display clamp 32→48
  (`text-display`) · display-xl clamp 40→64 (`text-display-xl`).
- Each step ships line-height and letter-spacing; display steps tighten tracking
  (-0.02em class). Fluid sizes only at display level — UI text never clamps.
- **The 9/10/11px zoo is dead**: anything below 12px is `text-caption` (11px). Two
  micro sizes total (caption, xs/label) — there is no third.
- Page anatomy: one `h1` per page at `text-headline`+ (marketing: display step);
  section heads `text-title`; card/panel titles `text-xl` or `text-sm font-medium`
  per density. Eyebrows: see §7.

## 5. Gloss ring + glow (the special material)

> **DECISION (owner directive, 2026-08-04):** the ring is upgraded to a LuxAlgo-grade
> **full-spectrum** material. This supersedes this section's earlier cold two-color
> rule and the "rainbow is LuxAlgo's identity" ban — **for the ring material only**.
> The spectrum still never appears anywhere else: no rainbow text, fills, icons,
> charts, or gradients outside `.gloss-ring` / `.gloss-ring-hover`.

The ring is a **material, not a color**: two conic layers on one element, rotating
together via the registered `--gloss-angle`:

1. **Core** (`::after`) — the 4K-sharp part: a crisp `--ring-core-width` (1.5px) line
   in the fully saturated `--ring-spectrum` loop (violet → blue → cyan → green →
   yellow → orange → magenta → violet, first stop repeated for a seamless join).
   Zero blur.
2. **Bloom** (`::before`) — the same spectrum beneath at `--ring-bloom-width`, with a
   **static** `blur(--ring-bloom-blur)` at `--ring-bloom-opacity`. Only the angle
   animates — never box-shadow or filter in the loop (§9); the blur is set once.

Both layers are masked border rings with `border-radius: inherit` — no clipped
corners on any radius.

- **One idle ring per viewport, ever.** Only the page's primary hero CTA may use
  `.gloss-ring` (idle rotation, `--dur-ring-idle` = 9s). Everything else uses
  `.gloss-ring-hover` (visible on hover/focus-visible only). The current double-idle
  in the homepage hero (CTA + LivePreview) must drop to one in Phase 3.
- **Hover/focus-visible = brighter + faster**: core steps to `--gloss-opacity-hover`,
  bloom to `--ring-bloom-opacity-hover`, and the clock shortens to `--dur-ring-hover`
  (3.5s). Hover rings run on the fast clock from birth so duration never changes
  mid-rotation.
- **Light theme**: the spectrum stops are overridden darker (the dark set's cyan and
  yellow vanish at 1.5px on white) and bloom opacity drops hard (0.18/0.32) so the
  glow never washes light surfaces.
- Ring + glow (`.btn-glow`) may combine on the hero CTA only. Elsewhere: pick neither
  or hover-ring.
- Featured cards (one per section max) may use `.gloss-ring-hover`.
- `prefers-reduced-motion`: rotation stops on both layers; the static spectrum +
  bloom remain (already wired).
- Never: rings on resting secondary buttons, more than one glowing element in view,
  the spectrum leaking outside this material.
- Retired with this upgrade: `--ring-glint` and `--ring-deep` (the old cold stops)
  are deleted from tokens.css; `--accent-2` is no longer part of the ring.

## 6. Ambient effects budget

- `.aurora`: **one per page**, in the hero. Never per-section (the old homepage had 5
  — 10 blurred layers; 4 must die in Phase 3). Colors are `--aurora-1/2` (accent
  spectrum, ≤13% alpha).
- `.hero-grid`: hero only, masked, `--hairline`-colored dots.
- `.glass`: floating surfaces only — sticky nav, chat dock, modals, palette. Never
  on in-flow cards.
- Shadows: `--shadow-card` (all cards, via `.card`) and `--shadow-pop` (overlays).
  No other shadows exist.

## 7. Section shell anatomy (every marketing section)

One wrapper, used by every homepage/marketing section — this alone fixes the
"different eras" problem:

1. **Eyebrow**: mono, `text-xs` (12px), uppercase, `tracking-widest`, `--muted`, with
   a 2-word `X · Y` label from the copy ("The Lab · What it does") and a small accent
   tick/dot prefix — the eyebrow's only accent.
2. **Heading**: `text-title`/`text-headline` (hero: display step), weight 600,
   tight tracking, `--ink`.
3. **Subcopy**: one short paragraph max, `text-lg`/`text-base`, `--muted`,
   `max-w-prose`.
4. **Content slot**: cards / proof object / chart. One proof element per section.
5. **Single CTA**: one link or button, never two competing.

Rhythm: vertical padding `--space-section` (clamp 64→128px) on EVERY section,
container `--container-max` (1152px) with the same horizontal padding site-wide.
App surfaces (playground/leaderboard) keep tighter rhythm (`--space-section-sm`)
but the same container and eyebrow grammar.

## 8. Radius, space, controls

- Radius language (never deviate): `--radius-card` 14px (cards/panels/pre),
  `--radius-control` 10px (buttons, inputs, selects, chips-with-text),
  `--radius-tag` 6px (tiny tags, inline code), `--radius-pill` (badges, pills,
  scroll thumbs). `rounded-md`/`rounded-xl`/`rounded-2xl` on surfaces are defects to
  migrate.
- Spacing: 4px base (Tailwind's default scale IS the token). Named: `--space-section`,
  `--space-section-sm`, `--container-max`, `--nav-h` (48px — derive playground
  offsets from it, kill the `calc(100vh-140px)` magic numbers in Phase 3).
- Controls: one Button component (primary accent fill + `text-background` ink,
  secondary hairline ghost, ring-CTA), one Input/Select recipe (`--bg-1`, hairline,
  `--radius-control`, `.focus-ring`). Focus: every interactive element gets
  `.focus-ring` (2px accent outline, 2px offset) — baked into primitives, not
  sprinkled.

## 9. Motion system

One easing family: `--ease-out` `cubic-bezier(0.22, 1, 0.36, 1)` for every entrance
and transition (ambient loops use `linear`/`ease-in-out` on their own clocks).

| Token | Value | Use |
|---|---|---|
| `--dur-micro` 150ms | hovers, toggles, opacity |
| `--dur-standard` 250ms | state changes, panels |
| `--dur-reveal` 500ms | scroll-in reveals (`--reveal-shift` 16px, `--reveal-stagger` 60ms, once, IntersectionObserver) |
| `--dur-slow` 700ms | chart live-draw, biggest reveals |
| `--dur-ring-idle` 9s | the one idle ring |
| `--dur-ring-hover` 3.5s | ring hover/focus clock (brighter + faster, §5) |
| `--dur-aurora-a/b` 44/56s | ambient drift |

Rules: animate only `transform` and `opacity` (blur layers pre-composited, never
animate `filter` in loops); no parallax; everything guarded by
`prefers-reduced-motion` — the static site must look finished, not disabled.
Reveal.tsx must consume the reveal tokens (currently 450ms/14px — normalize).

## 10. Theming

- Dark-first. Light survives ONLY because it is a pure token override
  (`[data-theme="light"]` in tokens.css) — if a light style can't be expressed as a
  token override, simplify the design until it can.
- Hover direction flips by theme via tokens (dark: accent-hover lighter; light:
  darker) — components never branch on theme.
- Charts must read tokens at runtime (CandleChart's `readTokens()` +
  MutationObserver pattern) — extend to all chart colors in Phase 2; no dark hexes
  baked into JS.

## 11. Do / Don't

**Do**
- Consume tokens for every color, size, radius, shadow, duration.
- Mono + tabular for every number; real data in every evidence mark.
- One accent moment, one proof object, one CTA per section.
- Hairline borders, 2-step elevation, quiet labels, loud numbers.
- Words + arrows alongside gain/loss color (WCAG 1.4.1).
- Design the reduced-motion/static state first; enhance from there.

**Don't**
- No hex/rgb/size literals in components or pages (§12 exceptions only).
- No accent as decoration; no green/red outside P&L; no warn on charts.
- No second idle animation in a viewport; no per-section auroras.
- No bold-everything; nothing below 11px; no new radii, durations, or easings.
- No drop shadows for decoration; no borders heavier than 1px.
- No fake urgency, fake numbers, decorative "live" indicators; the full spectrum
  lives in the ring material ONLY (owner directive, §5) — never text/fills/charts.
- Never merge forward and backtest curves; never trim disclaimers for layout.

## 12. Sanctioned exceptions (documented hardcodes)

- `ProviderLogo.tsx`: Google/Discord official brand hexes — brand marks are not
  themeable.
- `strategy/[slug]/opengraph-image.tsx`: OG renders off-DOM and cannot read CSS —
  constants must mirror tokens.css dark values, with a comment linking here.
  (Phase 4: migrated to the v3 ice-blue palette; keep in sync when tokens change.)
- Mask plumbing `#000` inside gloss-ring/hero-grid masks (structural, not color).
- `em`-based sizes inside `.docs-prose` (code 0.8125em) — prose-internal rhythm.
- `components/chartTokens.ts` FALLBACK map: SVG/canvas chart APIs can't consume
  CSS vars, so charts resolve tokens at runtime via `readChartTokens()` /
  `useChartTokens()` (theme-reactive). The module's fallback constants mirror
  the tokens.css dark values (pre-paint + non-DOM environments only) — the ONE
  place chart fallbacks live. Keep in sync when tokens change. (Phase 2)

## 13. Phase 2/3 re-pointing map (hexes that still exist outside tokens)

From AUDIT.md §7.1 — every one of these now has a token waiting:

| File | Hardcode | Token |
|---|---|---|
| EquityChart.tsx | `#8b7cf6` / `#3fa98e` / `#f23645` / hairline rgba / `#8a94a6` / `#161c28` | `--accent` / `--prev-run` / `--loss` / `--hairline` / `--muted` / `--bg-2` |
| CandleChart.tsx | `#089981` `#f23645` `#8b7cf6` + fallbacks | `--gain` `--loss` `--accent` via `readTokens()` |
| Sparkline.tsx | `#089981` / `#f23645` | `stroke="var(--gain)"` / `var(--loss)` (inline SVG reads CSS vars) |
| Modal.tsx / CommandPalette.tsx | `bg-black/60` / `bg-black/50` | `bg-overlay` (mapped) |
| DocsBits.tsx Callout warn | `var(--gloss-warm)` | `var(--warn)` (then delete alias) |
| opengraph-image.tsx | violet-era constants | mirror v3 dark tokens |

New utilities available now: `text-caption`, `text-title`, `text-headline`,
`text-display`, `text-display-xl`, `bg-overlay`, `text-warn`/`bg-warn-soft`,
`text-accent-2` (materials only).
