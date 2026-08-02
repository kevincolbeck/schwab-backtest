import type { ChatResponse, ChatTurn, RunResult, Spec, Template } from "./types";

interface FastAPIError {
  detail?: string | { validation_errors?: string[]; error?: string };
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as FastAPIError;
    if (typeof body.detail === "string") return body.detail;
    if (body.detail?.validation_errors?.length)
      return `Spec validation failed: ${body.detail.validation_errors.join("; ")}`;
    if (body.detail?.error) return body.detail.error;
  } catch {
    /* non-JSON error body */
  }
  return `Request failed (${res.status})`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const { accessToken } = await import("./supabase/client");
    const token = await accessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  } catch {
    /* auth not configured */
  }
  const res = await fetch(path, {
    ...init,
    headers: { ...headers, ...init?.headers },
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as T;
}

export function fetchTemplates(): Promise<{ templates: Template[] }> {
  return request("/api/templates");
}

export function runBacktest(body: {
  spec: Spec;
  start_date: string;
  end_date: string;
  parent_run_id?: string | null;
}): Promise<RunResult> {
  return request("/api/backtest", { method: "POST", body: JSON.stringify(body) });
}

export function sendChat(body: {
  messages: ChatTurn[];
  current_spec: Spec | null;
  last_run_stats: Record<string, unknown> | null;
  bt_summary: string;
}): Promise<ChatResponse> {
  return request("/api/chat", { method: "POST", body: JSON.stringify(body) });
}

export function fetchRun(runId: string): Promise<RunResult> {
  return request(`/api/runs/${encodeURIComponent(runId)}`);
}

export function deployRun(body: {
  run_id: string;
  name?: string;
}): Promise<{ deployment: { slug: string; name: string } }> {
  return request("/api/deploy", { method: "POST", body: JSON.stringify(body) });
}

export function createShare(runId: string): Promise<{ share_slug: string }> {
  return request("/api/share", {
    method: "POST",
    body: JSON.stringify({ run_id: runId }),
  });
}
