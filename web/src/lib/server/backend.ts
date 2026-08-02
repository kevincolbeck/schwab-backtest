/** Server-side proxy helper — the Railway/FastAPI URL never reaches the browser. */
export const BACKTEST_API_URL =
  process.env.BACKTEST_API_URL ?? "http://127.0.0.1:8787";

export async function proxyJSON(
  path: string,
  init?: RequestInit,
  sourceRequest?: Request,
): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const auth = sourceRequest?.headers.get("authorization");
  if (auth) headers["Authorization"] = auth;
  let upstream: Response;
  try {
    upstream = await fetch(`${BACKTEST_API_URL}${path}`, {
      ...init,
      headers: { ...headers, ...init?.headers },
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { detail: "The backtest service is unreachable. Is it running?" },
      { status: 502 },
    );
  }
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
