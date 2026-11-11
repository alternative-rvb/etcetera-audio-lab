import "server-only";
import { AppError, type ProviderId } from "./errors";
import { PYTHON_SERVICE_START_HINT, PYTHON_SERVICE_URL } from "./paths";
import { getRequestContext } from "./request-context";

// SECTION: Client HTTP unique vers le micro-service Python (Chatterbox, Whisper, logs, santé).
// Traduit les échecs réseau et HTTP en AppError explicites.

export interface PythonRequestOptions {
  provider?: ProviderId;
  timeoutMs: number;
  method?: "GET" | "POST";
  body?: BodyInit;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function isConnectionRefused(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const cause = (err as Error & { cause?: { code?: string } }).cause;
  return cause?.code === "ECONNREFUSED" || cause?.code === "ECONNRESET" || err.message.includes("fetch failed");
}

async function extractErrorDetail(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(text) as { detail?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (parsed.detail) return JSON.stringify(parsed.detail);
  } catch {
    // NOTE: corps non JSON, on garde le texte brut.
  }
  return text || response.statusText;
}

export async function callPythonService(path: string, options: PythonRequestOptions): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(options.timeoutMs);
  const signal = options.signal ? AbortSignal.any([timeoutSignal, options.signal]) : timeoutSignal;

  const requestId = getRequestContext()?.requestId;
  let response: Response;
  try {
    response = await fetch(`${PYTHON_SERVICE_URL}${path}`, {
      method: options.method ?? "GET",
      body: options.body,
      // NOTE: le requestId est transmis au service Python pour corréler ses logs avec ceux de Next.
      headers: { ...options.headers, ...(requestId ? { "X-Request-Id": requestId } : {}) },
      signal,
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new AppError("TIMEOUT", `Le service Python n'a pas répondu en ${Math.round(options.timeoutMs / 1000)} s.`, {
        provider: options.provider,
        hint: "Le premier appel charge le modèle et peut être long. Consultez les logs du service Python.",
        cause: err,
      });
    }
    if (isConnectionRefused(err)) {
      throw new AppError("PYTHON_SERVICE_DOWN", `Service Python injoignable sur ${PYTHON_SERVICE_URL}.`, {
        provider: options.provider,
        hint: PYTHON_SERVICE_START_HINT,
        cause: err,
      });
    }
    throw err;
  }

  if (!response.ok) {
    const detail = await extractErrorDetail(response);
    throw new AppError("ENGINE_FAILED", `Le service Python a renvoyé une erreur ${response.status} : ${detail}`, {
      provider: options.provider,
      details: { status: response.status, path },
    });
  }
  return response;
}
