import { proxyJSON } from "@/lib/server/backend";

export async function GET() {
  return proxyJSON("/markets/news");
}
