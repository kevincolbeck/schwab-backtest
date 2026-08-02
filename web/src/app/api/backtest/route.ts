import { proxyJSON } from "@/lib/server/backend";

export async function POST(request: Request) {
  const body = await request.text();
  return proxyJSON("/backtest", { method: "POST", body });
}
