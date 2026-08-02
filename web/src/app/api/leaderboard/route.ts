import { proxyJSON } from "@/lib/server/backend";

export async function GET(request: Request) {
  const minDays = new URL(request.url).searchParams.get("min_days");
  const qs = minDays ? `?min_days=${encodeURIComponent(minDays)}` : "";
  return proxyJSON(`/leaderboard${qs}`);
}
