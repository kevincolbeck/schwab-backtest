import { redirect } from "next/navigation";
import Card from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { getProfile } from "@/lib/server/stripe";
import { serverSession } from "@/lib/supabase/server";
import PortalButton from "./portal";

export const metadata = { title: "Account — Chat to Backtest" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const session = await serverSession();
  if (!session) redirect("/login");
  const { upgraded } = await searchParams;
  const profile = await getProfile(session.user.id);
  const plan = (profile?.plan as string) ?? "free";

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
          </div>
        </dl>
      </Card>
      <div className="mt-6 flex flex-wrap gap-3">
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
