import type { Metadata } from "next";
import AdminMetrics from "./AdminMetrics";

// Operator-only surface: token-gated against the service, never indexed,
// never linked from the product. Section 1's "simple dashboard".
export const metadata: Metadata = {
  title: "Operator metrics — Chat·Backtest",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminMetrics />;
}
