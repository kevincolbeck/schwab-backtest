import { serverSession } from "@/lib/supabase/server";
import { PACK_PRICE_IDS, PRICE_IDS, stripeConfigured, stripePost } from "@/lib/server/stripe";

export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return Response.json({ detail: "billing not configured" }, { status: 503 });
  }
  const session = await serverSession();
  if (!session) {
    return Response.json({ detail: "sign in first" }, { status: 401 });
  }
  const { plan, pack } = (await request.json()) as { plan?: string; pack?: string };
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  const base: Record<string, string> = {
    success_url: `${site}/account?upgraded=1`,
    cancel_url: `${site}/pricing`,
    client_reference_id: session.user.id,
    customer_email: session.user.email ?? "",
    "metadata[user_id]": session.user.id,
  };

  let params: Record<string, string>;
  if (pack) {
    const packDef = PACK_PRICE_IDS[pack];
    if (!packDef?.price) return Response.json({ detail: "unknown pack" }, { status: 422 });
    params = {
      ...base,
      mode: "payment",
      "line_items[0][price]": packDef.price,
      "line_items[0][quantity]": "1",
      "metadata[pack_credits]": String(packDef.credits),
    };
  } else {
    const price = plan ? PRICE_IDS[plan] : undefined;
    if (!price) return Response.json({ detail: "unknown plan" }, { status: 422 });
    params = {
      ...base,
      mode: "subscription",
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      "metadata[plan]": plan!,
      "subscription_data[metadata][user_id]": session.user.id,
      "subscription_data[metadata][plan]": plan!,
    };
  }

  try {
    const checkout = await stripePost("checkout/sessions", params);
    return Response.json({ url: checkout.url });
  } catch (e) {
    return Response.json(
      { detail: e instanceof Error ? e.message : "checkout failed" },
      { status: 502 },
    );
  }
}
