import { redirect } from "next/navigation";
import Card from "@/components/ui/Card";
import ReferralCard from "@/components/ReferralCard";
import { ButtonLink } from "@/components/ui/Button";
import { getCreditBalance, getProfile } from "@/lib/server/stripe";
import { serverSession } from "@/lib/supabase/server";
import PortalButton from "./portal";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Your account — Chat·Backtest",
  description:
    "Manage your Chat·Backtest plan, billing, and usage headroom.",
  path: "/account",
  noIndex: true,
});

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const session = await serverSession();
  if (!session) redirect("/login");
  const { upgraded } = await searchParams;
  const [profile, overflow] = await Promise.all([
    getProfile(session.user.id),
    getCreditBalance(session.user.id),
  ]);
  const plan = (profile?.plan as string) ?? "free";
  // Must state only what service/auth.py PLAN_LIMITS actually enforces —
  // no "priority engine" (no queue exists) and no paid exports (Python/Pine
  // export is free on every plan; only SHARE LINKS carry the watermark).
  const PLAN_BLURB: Record<string, string> = {
    free: "Unlimited daily-data backtests · 10 symbols/run · 1 public deployment",
    pro: "Intraday to 1m · 100 symbols/run · 10 deployments · private + clean share links",
    max: "Full US universe + crypto · 200 symbols/run · unlimited deployments",
  };

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-16 sm:px-6">
      <h1 className="text-headline font-semibold text-ink">Account</h1>
      {upgraded && (
        <p
          role="status"
          className="mt-4 rounded-(--radius-control) border border-accent bg-accent-soft p-3 text-sm"
        >
          Upgrade complete — welcome aboard. It can take a few seconds for the plan
          to reflect below.
        </p>
      )}
      <Card className="mt-6 text-sm">
        <dl className="space-y-4">
          <div>
            <dt className="text-caption uppercase tracking-widest text-muted">Email</dt>
            <dd className="mt-0.5 text-ink">{session.user.email}</dd>
          </div>
          <div>
            <dt className="text-caption uppercase tracking-widest text-muted">Plan</dt>
            <dd className="mt-0.5 font-medium uppercase text-ink">{plan}</dd>
            <dd className="mt-1 text-caption text-muted">
              {PLAN_BLURB[plan] ?? PLAN_BLURB.free}
            </dd>
          </div>
          {/* §5: usage isn't a currency any more. This shows only when a
              balance actually exists (a top-up pack or a grant), and it's
              framed for what it now is: headroom past the fair-use caps. */}
          {typeof overflow === "number" && overflow > 0 && (
            <div>
              <dt className="text-caption uppercase tracking-widest text-muted">
                Overflow headroom
              </dt>
              <dd className="tnum mt-0.5 text-ink">{overflow.toLocaleString()}</dd>
              <dd className="mt-1 text-caption text-muted">
                Only used if you pass a daily fair-use limit — most accounts
                never touch it.
              </dd>
            </div>
          )}
        </dl>
      </Card>
      <div className="mt-6 flex flex-wrap gap-3">
        <ReferralCard />
        {plan === "free" ? (
          <ButtonLink href="/pricing">Upgrade</ButtonLink>
        ) : (
          <PortalButton />
        )}
        <ButtonLink href="/dashboard" variant="secondary">
          Back to dashboard
        </ButtonLink>
      </div>
    </main>
  );
}
