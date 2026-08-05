import { NextResponse } from "next/server";
import { after } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { EmailOtpType, User } from "@supabase/supabase-js";
import { captureServer, identifyServer } from "@/lib/server/analytics";

// P0-5 `signup` detection: key on when the account was CONFIRMED, not created.
// signInWithOtp creates the auth row when the email is SENT (shouldCreateUser
// default), so created_at misses anyone who opens the link later than the
// window; email_confirmed_at is stamped at click time (and ≈ created_at for
// OAuth), which is the moment signup actually completes.
//
// TRIPWIRE: this event's coverage rests on every auth flow passing through
// this callback. That holds today (OTP + OAuth only — no signUp()/password
// anywhere in web/src). If Phase E ever adds email+password, client-side
// signUp() establishes a session WITHOUT hitting this route — the signup
// event must move or be duplicated there.
const SIGNUP_WINDOW_MS = 10 * 60 * 1000;
const SIGNUP_COOKIE = "cb_su"; // same-device dedup marker

// Auth landing: supports PKCE (?code=), OTP (?token_hash=&type=), and OAuth
// error bounces (?error=&error_description= — user cancelled, provider down).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/dashboard";
  const supabase = await supabaseServer();
  if (!supabase) return NextResponse.redirect(new URL("/", url.origin));

  // Provider/config failures arrive with ?error= and no code — don't lump
  // them in with expired magic links.
  if (url.searchParams.get("error")) {
    console.warn(
      "OAuth callback error:",
      url.searchParams.get("error"),
      url.searchParams.get("error_description") ?? "",
    );
    return NextResponse.redirect(new URL("/login?error=oauth-failed", url.origin));
  }

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  // The exchange/verify results already carry the user — no extra getUser()
  // round-trip on the login critical path (it would also rethrow non-Auth
  // errors AFTER the single-use code was consumed, 500ing a good login).
  let ok = false;
  let user: User | null = null;
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    user = data?.user ?? null;
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
    user = data?.user ?? null;
  }

  const response = NextResponse.redirect(
    new URL(ok ? next : "/login?error=link-expired", url.origin),
  );

  if (ok && user) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const confirmedAt = Date.parse(
      user.email_confirmed_at ?? user.confirmed_at ?? user.created_at ?? "",
    );
    const isSignup =
      Number.isFinite(confirmedAt) &&
      Date.now() - confirmedAt < SIGNUP_WINDOW_MS &&
      // Same-device dedup: a fresh link or quick re-login inside the window
      // must not fire signup twice (a second DEVICE inside the window still
      // can — rare, bounded, and the /admin cohort counts are immune either
      // way: they read Supabase profiles, not PostHog).
      !cookieHeader.includes(`${SIGNUP_COOKIE}=${user.id}`);
    if (isSignup) {
      const aid = cookieHeader.match(/(?:^|;\s*)cb_aid=([a-z0-9-]{8,64})/i)?.[1];
      const userId = user.id;
      const provider = user.app_metadata?.provider ?? "email";
      response.cookies.set(SIGNUP_COOKIE, userId, {
        path: "/",
        maxAge: 60 * 60 * 24,
        sameSite: "lax",
        httpOnly: true,
      });
      // Rotate the browser's anonymous analytics id after signup so a shared
      // machine's NEXT visitor doesn't inherit an id linked to this account
      // (the client regenerates when it sees the marker).
      response.cookies.set("cb_aid_rotate", "1", { path: "/", sameSite: "lax" });
      // after() runs post-redirect — analytics can't slow or break the login.
      after(async () => {
        if (aid) await identifyServer(userId, `anon:${aid}`);
        await captureServer("signup", userId, { provider });
      });
    }
  }
  return response;
}
