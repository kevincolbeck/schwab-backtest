import type {
  ChatResponse,
  ChatTurn,
  IndicatorSeries,
  RunResult,
  Spec,
  StrategyPagePayload,
  Template,
} from "./types";

interface ErrorDetail {
  message?: string;
  error?: string;
  balance?: number;
  validation_errors?: string[];
  [key: string]: unknown;
}

interface FastAPIError {
  detail?: string | ErrorDetail;
}

/** Structured API failure — keeps the HTTP status and the FastAPI `detail`
 *  payload so callers can react to specifics (e.g. 402 out_of_credits carries
 *  the true `balance` for the credit meter). `message` is unchanged from the
 *  old string-only behavior. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail: ErrorDetail | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let detail: ErrorDetail | null = null;
  let message = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as FastAPIError;
    if (typeof body.detail === "string") {
      message = body.detail;
    } else if (body.detail && typeof body.detail === "object") {
      detail = body.detail;
      if ("message" in detail) {
        message = String(detail.message ?? "Request failed");
      } else if (detail.validation_errors?.length) {
        message = `Spec validation failed: ${detail.validation_errors.join("; ")}`;
      } else if (detail.error) {
        message = detail.error;
      }
    }
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(message, res.status, detail);
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
  try {
    // P0-5: the first-party analytics id rides along so service-side events
    // (backtest_run, ai_message_sent) share the browser's distinct id — the
    // proxy forwards it, and signup later aliases it onto the account.
    const { anonymousId } = await import("./analytics");
    const aid = anonymousId();
    if (aid) headers["x-cb-aid"] = aid;
  } catch {
    /* analytics unavailable — never blocks the call */
  }
  const res = await fetch(path, {
    ...init,
    headers: { ...headers, ...init?.headers },
  });
  if (!res.ok) throw await parseError(res);
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

export function fetchBars(
  runId: string,
  symbol: string,
): Promise<{
  symbol: string;
  bars: Array<{ time: string; open: number; high: number; low: number; close: number }>;
  /** Optional: absent on older cached payloads — consumers must degrade. */
  indicators?: IndicatorSeries[];
}> {
  return request(
    `/api/runs/${encodeURIComponent(runId)}/bars?symbol=${encodeURIComponent(symbol)}`,
  );
}

export function fetchExplanation(spec: Spec): Promise<{ english: string }> {
  return request("/api/explain", { method: "POST", body: JSON.stringify({ spec }) });
}

export function fetchMe(): Promise<{
  plan: string;
  credits: number | null;
  limits: Record<string, unknown>;
}> {
  return request("/api/me");
}

/** A deployed record's public payload — used by the lab to fork a strategy
 *  straight off the ledger. */
export function fetchStrategy(slug: string): Promise<StrategyPagePayload> {
  return request(`/api/strategy/${encodeURIComponent(slug)}`);
}

/** §8 referral status: this user's code and the bonus slots it has earned. */
export function fetchReferral(): Promise<{
  enabled: boolean;
  code: string | null;
  bonus_deployments: number;
  max_bonus?: number;
}> {
  return request("/api/referral");
}

export function redeemReferral(code: string): Promise<{ bonus_deployments: number }> {
  return request("/api/referral/redeem", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}
