# Chat·Backtest — Full Visual Redesign Brief

You are acting as a veteran design engineer (30+ years) leading a complete visual overhaul of this site. The product, copy, and positioning stay. The visual execution gets rebuilt to a top-tier standard: think Linear/Mercury-level polish applied to a trading research product.

Read this entire brief before writing any code.

---

## 0. Prime directives (these override everything else)

1. **Consistency beats coolness.** Every page must look like it came from the same design system. If a treatment can't be applied site-wide, it doesn't ship. No page may look 2024 while another looks 2010.
2. **The UI must never overwhelm.** This is a complex product (strategy building, backtesting, forward ledgers). The design's job is to make it feel SIMPLE. Progressive disclosure everywhere: show the minimum first, reveal depth on demand.
3. **Do not rewrite the copy.** The existing voice ("Every opinion this AI has is a backtest," the honesty sections, the FAQ) is the brand and is compliance-deliberate. You may re-set copy typographically and trim for layout, but do not change meaning, add performance claims, or remove disclaimers.
   *(Amended 2026-08-04: the homepage hero and landing copy were superseded by `docs/CHATBACKTEST-BUILD.md` P0-2 — winners-first homepage, spec-verbatim hero: "Test the setup you saw online — before you risk a dollar." Do NOT revert to "Build it. Test it. Prove it in public." The voice/compliance rules in this directive still govern everything else.)*
4. **Take inspiration, never copy.** Reference sites inform techniques and quality bar. Do not replicate any competitor's layout, exact palette, or identity — especially LuxAlgo's.
5. **Restraint.** One signature effect used deliberately beats ten effects scattered. When in doubt, remove one thing (Chanel rule).

---

## 1. Phase 0 — Audit before touching anything

Crawl every route in this repo (homepage, /playground, /library, /markets, /leaderboard, /pricing, and any others). For each page, produce a short written audit in `design/AUDIT.md`:

- Inconsistencies: fonts, spacings, radii, button styles, card styles, colors that differ page-to-page
- Overwhelm points: any section showing more than ~6 items at once (the homepage template grid currently dumps 14 cards — this is the canonical offense)
- Dead weight: decoration that serves nothing
- What already works and must be preserved (the live chart demo, the stat displays, the honest-FAQ pattern)

If the site has a light/dark toggle, note it: the redesign is **dark-first**. Keep a light theme only if it can be derived automatically from tokens; otherwise cut it rather than maintain two half-finished themes.

Take screenshots as you work if the environment supports it. Judge your own output visually, not just in code.

---

## 2. Phase 1 — Design system FIRST (nothing else until this exists)

Create a single source of truth: `styles/tokens.css` (CSS custom properties) plus a `design/SYSTEM.md` documenting usage rules. Every component and page consumes tokens only. Zero hardcoded colors, sizes, or shadows anywhere else in the codebase. This is how consistency is enforced mechanically instead of by vibes.

### 2.1 Color

Base direction: **mostly dark, vibrant only where it earns it.**

- Canvas: near-black, not pure black. Start around `#0B0D10`–`#101318` (Mercury uses `#171721`; LuxAlgo uses `#000`; land between — pure black feels harsh and cheap on large screens, near-black feels premium).
- Surfaces: 2 elevation steps of slightly lighter graphite for cards/panels. Flat, borderless-or-hairline (1px, ~8% white) — depth from subtle lift, not drop shadows.
- Text: off-white primary (~92% white), muted secondary (~60%), faint tertiary (~38%).
- **One brand accent, used with extreme restraint** — primary CTAs, active states, and the signature effect only. Choose it yourself and justify the choice in SYSTEM.md, with these constraints: NOT LuxAlgo's look, NOT the default Linear-purple clone, and NOT green (green is reserved for profit semantics in a trading product). Strong candidates that fit the "proof/receipts" identity: electric cyan, cold amber (receipt-printer/terminal heritage), or ice blue. Pick one. Two accents max if the second is a gradient partner of the first.
- Semantic colors, never used decoratively: profit green, loss red, warning amber. Muted-but-clear variants that hold up on dark.
- The rainbow/spectrum conic gradient (see 3.2) is a **special material**, not part of the palette. It appears only on the highest-value interactive elements.

### 2.2 Typography

- Display/headings: a characterful geometric or neo-grotesque with tight tracking at large sizes (Geist, General Sans, or Söhne-class). Medium weights (500–600), never bold-everything — Mercury's entire premium feel comes from weight discipline.
- Body: highly readable companion (Inter or the display's text cut), 400/500.
- **Data/numbers: a monospace or tabular-figures face everywhere a number appears** — stats, CAGR, drawdowns, timestamps, hashes. This is core to the evidence identity (see 3.1). Tabular lining figures so columns align.
- Define a full scale (12/14/16/18/24/32/48/64+) with line-heights and letter-spacing per step. Fluid clamp() sizing for display text.

### 2.3 Space, radius, motion tokens

- 4px-base spacing scale. Section vertical rhythm generous and identical across pages (e.g., 96–128px desktop, 64px mobile).
- One radius language: pick (e.g., 12px cards / 8px inputs / pill buttons) and never deviate.
- Motion tokens: durations (150ms micro / 250ms standard / 500–700ms reveals), one easing family (e.g., cubic-bezier(0.22, 1, 0.36, 1) for entrances). All animation consumes these tokens.

---

## 3. Phase 2 — Component library

Build these as reusable components before rebuilding pages. Every page is then composed ONLY from these.

### 3.1 The signature: "evidence" visual language

This is the one place to spend boldness, and it's the strategic differentiator. LuxAlgo's identity is mystique; ours is **proof**. Express it visually:

- Numbers in mono/tabular figures with small unit labels
- Timestamps and truncated hash fragments (e.g., `a3f9…c21e ✓`) styled as quiet verification marks on ledger/leaderboard elements
- A subtle "verified/frozen" badge treatment for deployed strategies
- Data-first cards: the number is the hero, the label whispers
- Optional ambient texture: a very faint grid or scanline suggesting instrumentation — barely perceptible, never noisy

Every use of this language must encode something true (a real timestamp, a real hash, a real stat). Decoration pretending to be data is forbidden — it would undermine the entire brand.

### 3.2 The gradient ring (the LuxAlgo-inspired element, done our way)

An animated conic-gradient ring on interactive elements. Implementation technique:

- Pseudo-element behind the element, `inset: -1.5px` (thin ring), `border-radius: inherit`
- `background: conic-gradient(from var(--angle), <accent>, <partner-color>, <accent>)` — repeat the first stop for a seamless loop. Use OUR accent spectrum, not a full ROYGBIV rainbow (full rainbow = LuxAlgo's material; a 2–3 color spectrum of our accent = ours).
- Animate with `@property --angle { syntax: '<angle>'; ... }` + keyframes rotating 0–360deg. Register the property so the angle interpolates.
- Optional glow: duplicate the pseudo-element, `filter: blur(16px)`, low opacity, behind everything.
- **Usage rules (critical):** rotation runs on hover/focus for cards and secondary elements; only the single primary hero CTA may idle-animate, slowly (8s+). Guard everything with `@media (prefers-reduced-motion: reduce)` — static gradient, no rotation. Never more than one idle-animating ring in a viewport.

### 3.3 Standard kit

- Buttons: primary (accent fill), secondary (hairline ghost), ring-CTA (3.2). Consistent height, radius, focus-visible states.
- Cards: base surface card, stat card (evidence style), template/strategy card, testimonial-style card. One hover behavior for all: slight lift + hairline brightens + optional ring on featured items.
- Section shell: every homepage/marketing section uses the same wrapper — eyebrow label (`The Lab · What it does` pattern — already in the copy, keep it, style it in mono small-caps with an accent tick), heading, subcopy, content slot, single CTA. This shell alone will fix most of the "different eras" inconsistency.
- Sparkline/equity-curve mini-chart component with a live-draw animation on scroll-into-view (line drawing left→right, 700ms, once).
- Nav: sticky, backdrop-blur over the canvas, hairline bottom border that appears on scroll. Mobile menu equally polished.
- Accordion (FAQ), tab group, marquee logo row (if partner logos exist), footer.

---

## 4. Phase 3 — Page-by-page rebuild

Rebuild each page using only system components. Homepage first, then match every other route to it in the same pass — do not ship the homepage alone.

### Homepage specifics

- **Hero:** headline in display type with a kinetic touch (one subtle effect — e.g., a word that cycles or a gradient sweep across "Prove it" — not three effects). Behind it, a restrained ambient background: soft radial glow in the accent + faint grid. No stock video. The existing live Golden Cross chart demo is the hero's proof object — frame it in a premium surface card with the evidence treatment (mono stats, timestamp). Primary CTA gets the ring.
- **Template section (the 14-card wall): kill it.** Show exactly **6 curated templates** in a 3×2 grid — pick a representative spread across strategy types including at least one negative-return template (the honesty is the brand). Below: one "Explore all N strategies →" ghost button to /library. Card redesign: strategy name, one-line description, THE number (CAGR or total return) as the mono hero stat, tiny sparkline, category tag. Everything else lives on the detail view.
- Feature sections (Lab / Proof / Board, Strategist, Alerts-equivalent): alternate layout rhythm, each with one visual proof element (mini product mock, animated ledger rows, chart) — LuxAlgo's strongest pattern is a live product mock in every section; ours should be too, in our own skin.
- Honesty + FAQ sections: keep prominent; style the honesty cards with the evidence language (these are trust-builders — for a skeptical trader audience, this section converts).
- Scroll reveals: single system — fade-up 16px, 500ms, stagger 60ms between siblings, once, IntersectionObserver, reduced-motion guarded. Same everywhere. No parallax.

### Other routes

/playground (the actual tool), /library, /markets, /leaderboard, /pricing: same tokens, same components, same section shells. The app surfaces (playground, leaderboard) prioritize clarity over marketing flair — evidence styling shines here (mono tables, verification marks, semantic P&L colors). Library gets filter chips + the new template cards; leaderboard is THE brand page — make the append-only ledger *look* append-only (row timestamps, hashes, entries animating in on load).

---

## 5. Reference sites — fetch and study BEFORE designing

Fetch each and note (in `design/REFERENCES.md`) the specific technique to absorb. Absorb technique and quality bar; copy nothing literally.

1. `https://www.luxalgo.com/` — animated gradient rings on CTAs; eyebrow-label section pattern ("Quant · The intelligence"); a live product mock embedded in every feature section; overall motion polish. This is the competitor: match the energy, do not match the identity.
2. `https://linear.app` — the gold standard of restraint: type discipline, product-first sections, how few colors a premium dark site needs.
3. `https://mercury.com` — premium dark fintech trust: near-black canvas, ONE accent reserved for the primary action, weight-480-class display type, flat borderless graphite cards. The best reference for "trustworthy with money."
4. `https://vercel.com` — grid/gradient ambient backgrounds, interactive demos, dark-mode product screenshots as visuals.
5. `https://www.raycast.com` — vibrant color on dark done tastefully; glow treatments; personality without chaos.
6. `https://reflect.app` — the "HD futuristic glow" ceiling: orchestrated motion, luminous accents. Borrow atmosphere sparingly — it's a notes app, we're a research instrument.
7. `https://resend.com` — minimal dark developer aesthetic; how simple a polished page can be.
8. `https://www.composer.trade` — closest product category (AI strategy building + backtesting): study how they visualize strategies and results without overwhelming beginners.
9. `https://stripe.com` — gradient craft and section transitions (light site; steal the craft, not the theme).
10. `https://supabase.com` — how a single unexpected accent color creates instant brand recognition in a dark-UI category.

---

## 6. Performance & quality floor (non-negotiable)

- Animate only `transform` and `opacity` (compositor-friendly). Blur glows live on their own layers; never animate `filter` in a loop on more than one element.
- 60fps target; test the heaviest page. Lazy-load below-fold imagery and charts. No layout shift (reserve space for charts before hydration).
- `prefers-reduced-motion` honored globally — the site must be fully usable and still attractive with all motion off.
- Accessible contrast (4.5:1 body text), visible `:focus-visible` on every interactive element, semantic HTML, keyboard-navigable menus/accordions.
- Fully responsive to 360px. The template grid: 3 cols → 2 → 1. Nothing horizontal-scrolls except intentional marquees.
- Charts/hero degrade gracefully on mobile (static SVG fallback acceptable).

---

## 7. Definition of done

Run this checklist and fix failures before declaring completion:

- [ ] `tokens.css` exists; grep confirms zero hardcoded hex values in components/pages
- [ ] Every route uses the section shell + component kit; open any two pages side by side — same design system, obviously
- [ ] Homepage template section shows 6 cards + "Explore all" (14-card wall is gone)
- [ ] No viewport ever shows more than one idle-animating element
- [ ] All copy meaning, disclaimers, and honesty sections intact
- [ ] Reduced-motion, keyboard nav, contrast, and mobile all verified
- [ ] Lighthouse performance ≥ 90 on the homepage
- [ ] `design/AUDIT.md`, `design/SYSTEM.md`, `design/REFERENCES.md` written
- [ ] Final self-critique pass: screenshot each page, list the three weakest visual moments, fix them

Work in this order: Audit → Tokens → Components → Homepage → All other routes → QA. Commit at each phase boundary with a clear message.
