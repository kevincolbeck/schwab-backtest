import { pageMetadata } from "@/lib/seo";

/* login/page.tsx is a Client Component (OAuth buttons + magic-link form).
   noIndex: a sign-in form has no search value and shouldn't compete with the
   pages that do. */
export const metadata = pageMetadata({
  title: "Sign in — Chat·Backtest",
  description:
    "Sign in with Google, Discord, or a magic link to save strategies, export code, and deploy to the public forward-test ledger.",
  path: "/login",
  noIndex: true,
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
