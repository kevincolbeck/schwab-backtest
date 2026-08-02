import { serverSession } from "@/lib/supabase/server";
import { getProfile, stripePost } from "@/lib/server/stripe";

export async function POST(request: Request) {
  const session = await serverSession();
  if (!session) return Response.json({ detail: "sign in first" }, { status: 401 });

  const profile = await getProfile(session.user.id);
  const customer = profile?.stripe_customer_id as string | undefined;
  if (!customer) {
    return Response.json(
      { detail: "no billing profile yet — upgrade first" },
      { status: 404 },
    );
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  try {
    const portal = await stripePost("billing_portal/sessions", {
      customer,
      return_url: `${site}/account`,
    });
    return Response.json({ url: portal.url });
  } catch (e) {
    return Response.json(
      { detail: e instanceof Error ? e.message : "portal failed" },
      { status: 502 },
    );
  }
}
