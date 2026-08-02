import {
  updateProfile,
  verifyStripeSignature,
} from "@/lib/server/stripe";

interface StripeEvent {
  type: string;
  data: {
    object: {
      customer?: string;
      client_reference_id?: string | null;
      metadata?: Record<string, string>;
      status?: string;
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

  if (event.type === "checkout.session.completed") {
    const userId = obj.client_reference_id ?? obj.metadata?.user_id;
    const plan = obj.metadata?.plan;
    if (userId && (plan === "pro" || plan === "max")) {
      await updateProfile(
        { id: userId },
        { plan, stripe_customer_id: obj.customer ?? null },
      );
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
      await updateProfile(
        { id: userId },
        { plan: active && (plan === "pro" || plan === "max") ? plan : "free" },
      );
    } else if (obj.customer) {
      await updateProfile(
        { stripe_customer_id: obj.customer },
        { plan: active && (plan === "pro" || plan === "max") ? plan : "free" },
      );
    }
  }

  return Response.json({ received: true });
}
