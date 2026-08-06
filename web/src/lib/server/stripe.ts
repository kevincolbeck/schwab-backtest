/** Minimal server-side Stripe helpers (form-encoded REST — no SDK needed). */

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? "";

/** §5 flat tiers: Pro $39/mo · $390/yr, Max $99/mo · $990/yr (2 months free).
 *
 *  NO fallback to the retired $29/$79 prices (STRIPE_PRICE_PRO/MAX). Falling
 *  back would silently charge $29 while the page advertises $39 — a
 *  mispricing is strictly worse than a clear "not configured yet" error.
 *  Checkout additionally verifies the resolved price's unit_amount against
 *  lib/pricing.ts before creating a session, so a wrong env var can't
 *  mischarge either. Stripe prices are immutable, so existing subscribers
 *  keep billing on whatever price their subscription already holds. */
export const PRICE_IDS: Record<string, string | undefined> = {
  pro: process.env.STRIPE_PRICE_PRO_V2,
  max: process.env.STRIPE_PRICE_MAX_V2,
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
  max_annual: process.env.STRIPE_PRICE_MAX_ANNUAL,
};

/** Read a price object (to verify its amount before charging anyone). */
export async function stripeGetPrice(priceId: string): Promise<{ unit_amount?: number } | null> {
  if (!STRIPE_KEY) return null;
  try {
    const res = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
      headers: { Authorization: `Bearer ${STRIPE_KEY}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as { unit_amount?: number };
  } catch {
    return null;
  }
}

/** plan + billing interval → the price key above. */
export function priceKey(plan: string, interval?: string): string {
  return interval === "annual" ? `${plan}_annual` : plan;
}

export const PACK_PRICE_IDS: Record<string, { price: string | undefined; credits: number }> = {
  small: { price: process.env.STRIPE_PRICE_PACK_SMALL, credits: 500 },
  large: { price: process.env.STRIPE_PRICE_PACK_LARGE, credits: 1500 },
};

/** Overflow headroom granted each billing period (§5: invisible past the
 *  fair-use caps — never advertised as an allowance to ration). Annual plans
 *  invoice once a year, so they receive 12× the monthly grant up front. */
export const MONTHLY_CREDITS: Record<string, number> = { pro: 2500, max: 10000 };
export const ANNUAL_MULTIPLIER = 12;

/** Grant credits via the Supabase RPC (service-role only; ref = idempotency). */
export async function grantCredits(
  userId: string,
  amount: number,
  reason: string,
  ref: string,
): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) return false;
  const res = await fetch(`${url}/rest/v1/rpc/grant_credits`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_user: userId, p_amount: amount, p_reason: reason, p_ref: ref }),
  });
  return res.ok;
}

export function stripeConfigured(): boolean {
  return Boolean(STRIPE_KEY && PRICE_IDS.pro && PRICE_IDS.max);
}

export async function stripePost(
  path: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = body.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `stripe error (${res.status})`);
  }
  return body;
}

/** Verify a Stripe webhook signature (t=...,v1=... HMAC-SHA256). */
export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=") as [string, string]),
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

/** Update a profile row via the Supabase service role (server-only).
 *  When matching by id, upserts — a missing profile row must never
 *  swallow a paid upgrade. */
export async function updateProfile(
  match: Record<string, string>,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) return false;
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
  if (match.id) {
    const res = await fetch(`${url}/rest/v1/profiles?on_conflict=id`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id: match.id, ...patch }),
    });
    return res.ok;
  }
  const params = new URLSearchParams(
    Object.entries(match).map(([k, v]) => [k, `eq.${v}`]),
  );
  const res = await fetch(`${url}/rest/v1/profiles?${params}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  return res.ok;
}

/** Overflow balance (§5). Surfaced ONLY on /account — never in the lab —
 *  so someone who bought a top-up pack can still see what they hold. */
export async function getCreditBalance(userId: string): Promise<number | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/credit_balance`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_user: userId }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const value = await res.json();
    return typeof value === "number" ? value : null;
  } catch {
    return null;
  }
}

export async function getProfile(userId: string): Promise<Record<string, unknown> | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) return null;
  const res = await fetch(
    `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, cache: "no-store" },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}
