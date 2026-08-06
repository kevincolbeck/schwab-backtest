import { proxyJSON } from "@/lib/server/backend";

/** §8 referral status. Proxied like every other service call so the browser
 *  never talks to the FastAPI origin directly and the Bearer token, client IP
 *  and analytics id are forwarded consistently. */
export async function GET(request: Request) {
  return proxyJSON("/referral", {}, request);
}
