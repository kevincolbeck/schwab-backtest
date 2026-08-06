import { proxyJSON } from "@/lib/server/backend";

/** Public record payload, proxied so the LAB can load a deployed strategy's
 *  frozen spec (the "Fork this strategy" path).
 *
 *  The strategy PAGE renders server-side and calls the service directly; this
 *  route exists for the client-side lab, which cannot reach the FastAPI origin.
 *  Public data only — the service already 404s private deployments. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return proxyJSON(`/strategy/${encodeURIComponent(slug)}`, {}, request);
}
