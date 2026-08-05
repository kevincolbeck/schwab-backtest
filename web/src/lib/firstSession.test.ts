import { describe, expect, it } from "vitest";
import { FIRST_SESSION_MS, isFirstSession } from "./firstSession";

// P0-4 acceptance: no visible credit countdown during the first backtest and
// first AI conversation — the meter stays hidden while this returns true.
describe("isFirstSession", () => {
  const NOW = 1_754_400_000_000;

  it("treats a missing marker as the first session", () => {
    expect(isFirstSession(NOW, null)).toBe(true);
  });

  it("stays first inside the session window", () => {
    expect(isFirstSession(NOW, String(NOW))).toBe(true);
    expect(isFirstSession(NOW + FIRST_SESSION_MS - 1, String(NOW))).toBe(true);
  });

  it("ends exactly at the window boundary", () => {
    expect(isFirstSession(NOW + FIRST_SESSION_MS, String(NOW))).toBe(false);
  });

  it("shows the meter on a later visit", () => {
    const yesterday = NOW - 24 * 60 * 60 * 1000;
    expect(isFirstSession(NOW, String(yesterday))).toBe(false);
  });

  it("errs toward hiding on a corrupted marker", () => {
    expect(isFirstSession(NOW, "not-a-number")).toBe(true);
    expect(isFirstSession(NOW, "")).toBe(true);
  });

  it("hides for a future-stamped marker (checkFirstSession restamps it)", () => {
    // A future-stamped marker (clock skew) reads as first session — hiding is
    // the safe default. checkFirstSession treats markers >60s in the future
    // as corrupted and restamps, so the window can't outlive real skew.
    expect(isFirstSession(NOW, String(NOW + 60_000))).toBe(true);
  });
});
