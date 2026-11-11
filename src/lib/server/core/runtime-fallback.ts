import "server-only";
import type { ProviderHealth } from "@/lib/shared/types";
import { AppError, toAppError, type ProviderId } from "./errors";
import { createLogger } from "./logger";

// SECTION: Exécution principale en Node, avec bascule automatique vers un secours (service Python ou binaire Piper).

/** Seules les pannes de moteur déclenchent le secours : une annulation, un délai ou une entrée invalide ne changent pas d'avis en changeant de moteur. */
const FALLBACK_CODES = new Set(["ENGINE_UNAVAILABLE", "ENGINE_FAILED", "INTERNAL"]);

function isAbort(err: unknown, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted) || (err instanceof Error && err.name === "AbortError");
}

export async function runWithFallback<T>(options: {
  provider: ProviderId;
  primaryLabel: string;
  fallbackLabel: string;
  primary: () => Promise<T>;
  fallback: () => Promise<T>;
  signal?: AbortSignal;
}): Promise<{ result: T; fallback: boolean }> {
  const { provider, primaryLabel, fallbackLabel, signal } = options;
  try {
    return { result: await options.primary(), fallback: false };
  } catch (err) {
    if (isAbort(err, signal)) throw err;
    const primaryError = toAppError(err, provider);
    if (!FALLBACK_CODES.has(primaryError.code)) throw primaryError;

    createLogger(provider).warn("runtime.fallback", `${primaryLabel} indisponible, bascule vers ${fallbackLabel}.`, {
      meta: { code: primaryError.code, reason: primaryError.message, hint: primaryError.hint },
      error: primaryError.cause ?? primaryError,
    });

    try {
      return { result: await options.fallback(), fallback: true };
    } catch (fallbackErr) {
      if (isAbort(fallbackErr, signal)) throw fallbackErr;
      const fallbackError = toAppError(fallbackErr, provider);
      // NOTE: le hint du moteur principal passe en premier, c'est lui qu'il faut réparer.
      throw new AppError(fallbackError.code, `${primaryLabel} : ${primaryError.message} Secours ${fallbackLabel} : ${fallbackError.message}`, {
        provider,
        status: fallbackError.status,
        hint: primaryError.hint ?? fallbackError.hint,
        details: { primary: primaryError.details, fallback: fallbackError.details },
        cause: fallbackError,
      });
    }
  }
}

/** Santé d'un moteur à deux étages : prêt si Node l'est, dégradé si seul le secours répond. */
export function combineHealth(node: ProviderHealth, fallback: ProviderHealth, fallbackLabel: string): ProviderHealth {
  if (node.status === "ok") return { ...node, details: { ...node.details, fallback: fallback.status } };
  if (fallback.status !== "down") {
    return {
      status: "degraded",
      reason: `${node.reason ?? "Exécution Node indisponible."} Secours ${fallbackLabel} actif.`,
      hint: node.hint,
      details: { ...fallback.details, node: node.status },
    };
  }
  return {
    status: "down",
    reason: `${node.reason ?? "Exécution Node indisponible."} Secours ${fallbackLabel} indisponible aussi.`,
    hint: [node.hint, fallback.hint].filter(Boolean).join(" "),
  };
}
