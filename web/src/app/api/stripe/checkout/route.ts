import { serverSession } from "@/lib/supabase/server";
import { PRICE_IDS, stripeConfigured, stripePost } from "@/lib/server/stripe";

export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return Response.json({ detail: "billing not configured" }, { status: 503 });
  }
  const session = await serverSession();
  if (!session) {
    return Response.json({ detail: "sign in first" }, { status: 401 });
  }
  const { plan } = (await request.json()) as { plan?: string };
  const price = plan ? PRICE_IDS[plan] : undefined;
  if (!price) {
    return Response.json({ detail: "unknown plan" }, { status: 422 });
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  try {
    const checkout = await stripePost("checkout/sessions", {
      mode: "subscription",
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      success_url: `${site}/account?upgraded=1`,
      cancel_url: `${site}/pricing`,
      client_reference_id: session.user.id,
      customer_email: session.user.email ?? "",
      "metadata[user_id]": session.user.id,
      "metadata[plan]": plan!,
      "subscription_data[metadata][user_id]": session.user.id,
      "subscription_data[metadata][plan]": plan!,
    });
    return Response.json({ url: checkout.url });
  } catch (e) {
    return Response.json(
      { detail: e instanceof Error ? e.message : "checkout failed" },
      { status: 502 },
    );
  }
}
