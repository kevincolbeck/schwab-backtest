import { proxyJSON } from "@/lib/server/backend";

// Admin-only cohort metrics (P0-5). Pure pass-through: the service's
// ADMIN_TOKEN guard is the auth — this route just keeps the Railway URL
// server-side like every other proxy route.
export async function GET(request: Request) {
  const token = request.headers.get("x-admin-token") ?? "";
  const force = new URL(request.url).searchParams.get("force") === "1";
  return proxyJSON(`/admin/metrics${force ? "?force=true" : ""}`, {
    headers: { "x-admin-token": token },
  });
}
