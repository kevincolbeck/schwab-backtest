import { after } from "next/server";
import {
  MONTHLY_CREDITS,
  getProfile,
  grantCredits,
  updateProfile,
  verifyStripeSignature,
} from "@/lib/server/stripe";
import { captureServer, eventUuid } from "@/lib/server/analytics";

interface StripeEvent {
  type: string;
  data: {
    object: {
      id?: string;
      customer?: string;
      client_reference_id?: string | null;
      metadata?: Record<string, string>;
      status?: string;
      // invoice fields
      subscription?: string;
      parent?: { subscription_details?: { metadata?: Record<string, string> } };
    };
  };
}

// Stripe → plan sync. Configure the endpoint in the Stripe dashboard pointing
// at <site>/api/stripe/webhook and set STRIPE_WEBHOOK_SECRET.
export async function POST(request: Request) {
  const payload = await request.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (secret) {
    const ok = await verifyStripeSignature(
      payload,
      request.headers.get("stripe-signature"),
      secret,
    );
    if (!ok) return Response.json({ detail: "bad signature" }, { status: 400 });
  } else if (process.env.NODE_ENV === "production") {
    return Response.json({ detail: "webhook secret not configured" }, { status: 503 });
  }

  const event = JSON.parse(payload) as StripeEvent;
  const obj = event.data.object;

  // Any Supabase write failure → 500 so Stripe redelivers. Safe to retry: the
  // ledger's (user_id, reason, ref) unique index makes re-grants idempotent.
  const retry = () => Response.json({ detail: "supabase write failed" }, { status: 500 });

  if (event.type === "checkout.session.completed") {
    const userId = obj.client_reference_id ?? obj.metadata?.user_id;
    const plan = obj.metadata?.plan;
    const packCredits = Number(obj.metadata?.pack_credits ?? 0);
    if (userId && packCredits > 0) {
      // Top-up pack purchase (mode=payment). Ref = session id → idempotent.
      const ok = await grantCredits(userId, packCredits, "pack_purchase", obj.id ?? "unknown");
      if (!ok) return retry();
      // P0-5: a pack purchase IS a free→paid conversion — without this, pack
      // buyers read as "never converted" in Section 1 metric #4.
      const uid = userId;
      try {
        after(() =>
          captureServer(
            "upgrade_completed",
            uid,
            { plan: "pack", credits: packCredits },
            eventUuid(`pack:${obj.id ?? uid}`),
          ),
        );
      } catch {
        /* after() unavailable (non-Vercel self-host) — never 500 a webhook */
      }
    }
    if (userId && (plan === "pro" || plan === "max")) {
      const ok = await updateProfile(
        { id: userId },
        { plan, stripe_customer_id: obj.customer ?? null },
      );
      if (!ok) return retry();
      // Monthly allowance is NOT granted here: invoice.payment_succeeded fires
      // for the first payment too, and granting in both would double it.
      // P0-5 `upgrade_completed`: after the profile write succeeded, so the
      // event mirrors reality. Stripe delivery is at-least-once (it can
      // redeliver even after our 200 on a timeout), so the event carries a
      // deterministic uuid — PostHog dedupes same-day repeats.
      const uid = userId;
      const chosenPlan = plan;
      try {
        after(() =>
          captureServer(
            "upgrade_completed",
            uid,
            { plan: chosenPlan },
            eventUuid(`plan:${obj.id ?? uid}`),
          ),
        );
      } catch {
        /* after() unavailable — never 500 a webhook over analytics */
      }
    }
  } else if (event.type === "invoice.payment_succeeded") {
    // Monthly renewals refresh the allowance. Ref = invoice id → idempotent.
    const meta = obj.parent?.subscription_details?.metadata ?? {};
    let userId = meta.user_id;
    let plan = meta.plan;
    if (!userId && obj.customer) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_KEY;
      if (url && key) {
        const res = await fetch(
          `${url}/rest/v1/profiles?stripe_customer_id=eq.${encodeURIComponent(obj.customer)}&select=id,plan`,
          { headers: { apikey: key, Authorization: `Bearer ${key}` } },
        );
        const rows = res.ok ? ((await res.json()) as Array<{ id: string; plan: string }>) : [];
        userId = rows[0]?.id;
        plan = plan ?? rows[0]?.plan;
      }
    }
    if (userId && (plan === "pro" || plan === "max")) {
      const ok = await grantCredits(userId, MONTHLY_CREDITS[plan], "monthly_grant", obj.id ?? "unknown");
      if (!ok) return retry();
    }
  } else if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const userId = obj.metadata?.user_id;
    const plan = obj.metadata?.plan;
    const active = event.type !== "customer.subscription.deleted" &&
      (obj.status === "active" || obj.status === "trialing");
    if (userId) {
      const ok = await updateProfile(
        { id: userId },
        { plan: active && (plan === "pro" || plan === "max") ? plan : "free" },
      );
      if (!ok) return retry();
    } else if (obj.customer) {
      const ok = await updateProfile(
        { stripe_customer_id: obj.customer },
        { plan: active && (plan === "pro" || plan === "max") ? plan : "free" },
      );
      if (!ok) return retry();
    }
  }

  return Response.json({ received: true });
}
