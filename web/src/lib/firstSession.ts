/** P0-4 — remove credit anxiety: the lab's ◈ usage meter stays hidden during
 * a new user's first session, so the first backtest and first AI conversation
 * never show a draining counter. "First session" is time-boxed: the first
 * FIRST_SESSION_MS after this browser first opens the lab.
 *
 * Client-only (localStorage) — call checkFirstSession() from an effect. */

export const FIRST_SEEN_KEY = "cb_lab_first_seen";
export const FIRST_SESSION_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Pure decision: is `now` still inside the first session that started at the
 * stored timestamp? A missing or unreadable marker means the visit we are
 * looking at IS the first session. */
export function isFirstSession(now: number, stored: string | null): boolean {
  // Number("") === 0, so an empty marker must be caught explicitly — it would
  // otherwise read as an epoch-old session and reveal the meter.
  if (stored === null || stored.trim() === "") return true;
  const startedAt = Number(stored);
  if (!Number.isFinite(startedAt)) return true;
  return now - startedAt < FIRST_SESSION_MS;
}

/** Reads (and, on first visit, stamps) the marker. Storage failures — private
 * mode, blocked cookies — err toward hiding the meter: a veteran losing a
 * toolbar number is harmless, a newcomer watching one drain is the bug. */
export function checkFirstSession(): boolean {
  try {
    const now = Date.now();
    const stored = window.localStorage.getItem(FIRST_SEEN_KEY);
    const first = isFirstSession(now, stored);
    // A future-stamped marker (clock skew at stamp time) would otherwise hide
    // the meter until wall-clock catches up — restamp it like corruption.
    const corrupted =
      stored !== null &&
      (stored.trim() === "" ||
        !Number.isFinite(Number(stored)) ||
        Number(stored) > now + 60_000);
    if (stored === null || corrupted) {
      window.localStorage.setItem(FIRST_SEEN_KEY, String(now));
    }
    return first;
  } catch {
    return true;
  }
}
