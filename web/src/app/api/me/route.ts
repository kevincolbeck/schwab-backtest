import { proxyJSON } from "@/lib/server/backend";

export async function GET(request: Request) {
  return proxyJSON("/me", {}, request);
}
