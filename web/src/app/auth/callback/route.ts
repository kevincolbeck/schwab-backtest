import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

// Magic-link landing: supports both PKCE (?code=) and OTP (?token_hash=&type=).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/dashboard";
  const supabase = await supabaseServer();
  if (!supabase) return NextResponse.redirect(new URL("/", url.origin));

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
