/** §5 plan prices — ONE source for what we advertise and what we charge.
 *
 * The pricing page renders from this, and the checkout route verifies the
 * resolved Stripe price's `unit_amount` against it before creating a session.
 * That makes "the page says $39 but Stripe charges $29" structurally
 * impossible, whether the cause is a stale env var, a fallback, or a typo.
 *
 * Amounts are in CENTS, matching Stripe. Annual = 10× monthly (2 months free).
 */

export const PLAN_PRICES = {
  pro: { monthly: 3900, annual: 39000 },
  max: { monthly: 9900, annual: 99000 },
} as const;

export type PaidPlan = keyof typeof PLAN_PRICES;
export type Interval = "monthly" | "annual";

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === "pro" || value === "max";
}

export function expectedAmount(plan: PaidPlan, interval: Interval): number {
  return PLAN_PRICES[plan][interval];
}

/** Dollars, for display. */
export function dollars(cents: number): number {
  return Math.round(cents / 100);
}

/** The per-month figure shown on an annual card (annual total ÷ 12). */
export function perMonthDisplay(plan: PaidPlan, interval: Interval): number {
  const cents = expectedAmount(plan, interval);
  return interval === "annual" ? Math.round(cents / 12 / 100) : dollars(cents);
}
