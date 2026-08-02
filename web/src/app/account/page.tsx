import Link from "next/link";
import { redirect } from "next/navigation";
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
    <main className="mx-auto w-full max-w-lg px-6 py-16">
      <h1 className="text-2xl font-semibold">Account</h1>
      {upgraded && (
        <p role="status" className="mt-4 rounded-lg border border-accent/40 bg-accent-soft p-3 text-sm">
          Upgrade complete — welcome aboard. It can take a few seconds for the plan
          to reflect below.
        </p>
      )}
      <dl className="mt-6 space-y-4 rounded-xl border border-hairline bg-panel p-5 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted">Email</dt>
          <dd className="mt-0.5">{session.user.email}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted">Plan</dt>
          <dd className="mt-0.5 font-medium uppercase">{plan}</dd>
        </div>
      </dl>
      <div className="mt-6 flex flex-wrap gap-3">
        {plan === "free" ? (
          <Link
            href="/pricing"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Upgrade
          </Link>
        ) : (
          <PortalButton />
        )}
        <Link
          href="/dashboard"
          className="rounded-md border border-hairline px-4 py-2 text-sm hover:bg-panel"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
