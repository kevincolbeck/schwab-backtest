import { proxyJSON } from "@/lib/server/backend";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  return proxyJSON(`/runs/${encodeURIComponent(runId)}`);
}
