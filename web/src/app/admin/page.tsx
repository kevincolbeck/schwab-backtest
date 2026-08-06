import AdminMetrics from "./AdminMetrics";
import { pageMetadata } from "@/lib/seo";

// Operator-only surface: token-gated against the service, never indexed,
// never linked from the product. Section 1's "simple dashboard".
export const metadata = pageMetadata({
  title: "Operator metrics — Chat·Backtest",
  description: "Internal cohort dashboard: activation and deployment rate by signup week.",
  path: "/admin",
  noIndex: true,
});

export default function AdminPage() {
  return <AdminMetrics />;
}
