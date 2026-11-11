"use client";

import { toast } from "sonner";
import type { ApiErrorBody, ApiErrorCode } from "@/lib/shared/types";
import { LOG_SOURCE_LABELS } from "@/lib/shared/provider-catalog";
import { hintToPlainText } from "@/components/ui/hint-text";

// SECTION: Client HTTP unique de l'UI. Lit l'enveloppe d'erreur de l'API et expose une ApiClientError typée.

export class ApiClientError extends Error {
  readonly code: ApiErrorCode | "NETWORK" | "ABORTED";
  readonly status: number;
  readonly hint?: string;
  readonly requestId?: string;
  readonly provider?: string;

  constructor(init: { code: ApiClientError["code"]; message: string; status: number; hint?: string; requestId?: string; provider?: string }) {
    super(init.message);
    this.name = "ApiClientError";
    this.code = init.code;
    this.status = init.status;
    this.hint = init.hint;
    this.requestId = init.requestId;
    this.provider = init.provider;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, cache: "no-store" });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiClientError({ code: "ABORTED", message: "Requête annulée.", status: 0 });
    }
    throw new ApiClientError({
      code: "NETWORK",
      message: "Serveur Next injoignable.",
      hint: "Vérifiez que `npm run dev` tourne toujours.",
      status: 0,
    });
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiClientError({
      code: body?.error.code ?? "INTERNAL",
      message: body?.error.message ?? `Erreur HTTP ${response.status}.`,
      hint: body?.error.hint,
      requestId: body?.error.requestId ?? response.headers.get("X-Request-Id") ?? undefined,
      provider: body?.error.provider,
      status: response.status,
    });
  }
  return (await response.json()) as T;
}

export function jsonBody(data: unknown): RequestInit {
  return { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
}

/** Toast d'erreur standard : message, piste de résolution et lien vers les logs de la requête. */
export function showErrorToast(error: unknown, fallbackTitle = "Action impossible") {
  if (error instanceof ApiClientError) {
    if (error.code === "ABORTED") return;
    const providerLabel = error.provider ? LOG_SOURCE_LABELS[error.provider as keyof typeof LOG_SOURCE_LABELS] : undefined;
    toast.error(providerLabel ? `${providerLabel} : ${error.message}` : error.message, {
      description: hintToPlainText(error.hint),
      duration: 9000,
      action: error.requestId
        ? { label: "Voir les logs", onClick: () => window.open(`/logs?requestId=${error.requestId}`, "_self") }
        : undefined,
    });
    return;
  }
  toast.error(fallbackTitle, { description: error instanceof Error ? error.message : String(error) });
}

/** Identifiant de requête généré côté navigateur, transmis en X-Request-Id pour suivre les logs en direct. */
export function createClientRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
