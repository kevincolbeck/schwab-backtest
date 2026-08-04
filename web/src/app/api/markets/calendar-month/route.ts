import { proxyJSON } from "@/lib/server/backend";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const qs = new URLSearchParams();
  for (const key of ["kind", "year", "month"] as const) {
    const value = params.get(key);
    if (value) qs.set(key, value);
  }
  const suffix = qs.size ? `?${qs.toString()}` : "";
  return proxyJSON(`/markets/calendar-month${suffix}`);
}
