import { serverSession } from "@/lib/supabase/server";
import {
  PACK_PRICE_IDS,
  PRICE_IDS,
  priceKey,
  stripeConfigured,
  stripeGetPrice,
  stripePost,
} from "@/lib/server/stripe";
import { expectedAmount, isPaidPlan, type Interval } from "@/lib/pricing";

export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return Response.json({ detail: "billing not configured" }, { status: 503 });
  }
  const session = await serverSession();
  if (!session) {
    return Response.json({ detail: "sign in first" }, { status: 401 });
  }
  const { plan, pack, interval } = (await request.json()) as {
    plan?: string;
    pack?: string;
    interval?: string;
  };
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
    // Only these two are real plans; `interval` picks monthly vs annual.
    // metadata.plan stays the BASE name — the webhook writes it straight to
    // profiles.plan and only accepts "pro"/"max".
    if (!isPaidPlan(plan)) {
      return Response.json({ detail: "unknown plan" }, { status: 422 });
    }
    if (interval && interval !== "monthly" && interval !== "annual") {
      return Response.json({ detail: "unknown billing interval" }, { status: 422 });
    }
    const billing: Interval = interval === "annual" ? "annual" : "monthly";
    const price = PRICE_IDS[priceKey(plan, billing)];
    if (!price) {
      return Response.json(
        { detail: "that billing option isn't configured yet" },
        { status: 503 },
      );
    }
    // Never charge an amount the page didn't advertise. A stale or wrong
    // STRIPE_PRICE_* would otherwise bill silently at the wrong rate.
    const live = await stripeGetPrice(price);
    const want = expectedAmount(plan, billing);
    if (!live || live.unit_amount !== want) {
      console.error(
        `checkout blocked: ${plan}/${billing} price ${price} is ` +
          `${live?.unit_amount ?? "unreadable"}, expected ${want}`,
      );
      return Response.json(
        { detail: "that billing option isn't configured correctly — please contact support" },
        { status: 503 },
      );
    }
    params = {
      ...base,
      mode: "subscription",
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      "metadata[plan]": plan,
      "metadata[interval]": billing,
      "subscription_data[metadata][user_id]": session.user.id,
      "subscription_data[metadata][plan]": plan,
      "subscription_data[metadata][interval]": billing,
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
