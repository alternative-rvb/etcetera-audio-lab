import "server-only";
import { ZodError } from "zod";
import type { ApiErrorCode, SttProviderId, TtsProviderId } from "@/lib/shared/types";

// SECTION: Modèle d'erreur unique. Toute erreur levée par un provider ou une route devient une AppError
// avant d'être renvoyée au client (enveloppe JSON) et tracée dans les logs.

const DEFAULT_HTTP_STATUS: Record<ApiErrorCode, number> = {
  VALIDATION: 400,
  VOICE_NOT_FOUND: 400,
  ENGINE_UNAVAILABLE: 503,
  PYTHON_SERVICE_DOWN: 503,
  TIMEOUT: 504,
  ENGINE_FAILED: 502,
  NOT_FOUND: 404,
  INTERNAL: 500,
};

export type ProviderId = TtsProviderId | SttProviderId;

export interface AppErrorOptions {
  status?: number;
  provider?: ProviderId;
  hint?: string;
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly provider?: ProviderId;
  readonly hint?: string;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = options.status ?? DEFAULT_HTTP_STATUS[code];
    this.provider = options.provider;
    this.hint = options.hint;
    this.details = options.details;
  }
}

/** Le client a fermé la connexion (Next lève ResponseAborted) : ce n'est ni une panne du moteur ni un délai. */
export function isClientAbort(err: unknown, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted) || (err instanceof Error && err.name === "ResponseAborted");
}

function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
}

/** Convertit n'importe quelle erreur en AppError, en conservant l'originale comme `cause`. */
export function toAppError(err: unknown, provider?: ProviderId): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
    const summary = details.map((d) => (d.path ? `${d.path} : ${d.message}` : d.message)).join(" ; ");
    return new AppError("VALIDATION", `Requête invalide. ${summary}`, { provider, details, cause: err });
  }

  if (isTimeoutError(err)) {
    return new AppError("TIMEOUT", "Le délai maximal de traitement a été dépassé.", {
      provider,
      hint: "Réessayez avec un texte plus court ou un modèle plus léger.",
      cause: err,
    });
  }

  const message = err instanceof Error ? err.message : String(err);
  if (provider) {
    return new AppError("ENGINE_FAILED", `Échec du moteur : ${message}`, { provider, cause: err });
  }
  return new AppError("INTERNAL", "Erreur interne inattendue.", { cause: err });
}
