import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

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

  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  }
  return NextResponse.redirect(
    new URL(ok ? next : "/login?error=link-expired", url.origin),
  );
}
