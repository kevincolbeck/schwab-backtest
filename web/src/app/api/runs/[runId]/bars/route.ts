import { proxyJSON } from "@/lib/server/backend";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const symbol = new URL(request.url).searchParams.get("symbol") ?? "";
  return proxyJSON(
    `/runs/${encodeURIComponent(runId)}/bars?symbol=${encodeURIComponent(symbol)}`,
  );
}
