import { describe, expect, it } from "vitest";
import {
  PLAN_PRICES,
  dollars,
  expectedAmount,
  isPaidPlan,
  perMonthDisplay,
} from "./pricing";

/* These numbers are load-bearing twice: the pricing page renders them AND the
   checkout route refuses to create a session unless Stripe's price object
   reports the same unit_amount. If they drift from the Stripe prices created
   by scripts/setup_stripe_v2.py, checkout fails closed (503) rather than
   mischarging — this suite pins the intended values. */
describe("plan prices", () => {
  it("matches the §5 spec and the created Stripe prices", () => {
    expect(PLAN_PRICES.pro.monthly).toBe(3900); // $39/mo
    expect(PLAN_PRICES.max.monthly).toBe(9900); // $99/mo
    expect(PLAN_PRICES.pro.annual).toBe(39000); // $390/yr
    expect(PLAN_PRICES.max.annual).toBe(99000); // $990/yr
  });

  it("prices annual at 10 months — literally two months free", () => {
    for (const plan of ["pro", "max"] as const) {
      expect(PLAN_PRICES[plan].annual).toBe(PLAN_PRICES[plan].monthly * 10);
    }
  });

  it("shows an honest per-month figure on the annual card", () => {
    // $390/yr ÷ 12 = $32.50 → $33 displayed, and it must be BELOW the
    // monthly rate or the toggle would be advertising a worse deal.
    expect(perMonthDisplay("pro", "annual")).toBe(33);
    expect(perMonthDisplay("max", "annual")).toBe(83);
    for (const plan of ["pro", "max"] as const) {
      expect(perMonthDisplay(plan, "annual")).toBeLessThan(
        perMonthDisplay(plan, "monthly"),
      );
    }
  });

  it("renders monthly at face value", () => {
    expect(perMonthDisplay("pro", "monthly")).toBe(39);
    expect(perMonthDisplay("max", "monthly")).toBe(99);
    expect(dollars(3900)).toBe(39);
  });

  it("guards the plan allowlist", () => {
    expect(isPaidPlan("pro")).toBe(true);
    expect(isPaidPlan("max")).toBe(true);
    expect(isPaidPlan("free")).toBe(false);
    expect(isPaidPlan(undefined)).toBe(false);
    expect(isPaidPlan("pro_annual")).toBe(false); // never a checkout plan value
  });

  it("expectedAmount is what checkout verifies against Stripe", () => {
    expect(expectedAmount("pro", "monthly")).toBe(3900);
    expect(expectedAmount("max", "annual")).toBe(99000);
  });
});
