import "server-only";
import type { ProviderHealth } from "@/lib/shared/types";
import { AppError } from "./errors";
import { PYTHON_SERVICE_START_HINT } from "./paths";
import { callPythonService } from "./python-service-client";

// SECTION: Santé du service Python (/health), mise en cache 3 s pour éviter de le marteler.

const HEALTH_CACHE_MS = 3_000;
let cached: { at: number; value: ProviderHealth } | null = null;

export async function fetchPythonServiceHealth(): Promise<ProviderHealth> {
  if (cached && Date.now() - cached.at < HEALTH_CACHE_MS) return cached.value;
  let value: ProviderHealth;
  try {
    const response = await callPythonService("/health", { timeoutMs: 2_000 });
    const details = (await response.json()) as Record<string, unknown>;
    value = { status: details.status === "ok" ? "ok" : "degraded", details };
  } catch (err) {
    value = {
      status: "down",
      reason: err instanceof AppError ? err.message : "Service Python injoignable.",
      hint: PYTHON_SERVICE_START_HINT,
    };
  }
  cached = { at: Date.now(), value };
  return value;
}
