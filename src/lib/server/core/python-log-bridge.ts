import "server-only";
import type { LogLevel, LogSource } from "@/lib/shared/types";
import { countLogSubscribers, createLogger, writeLog } from "./logger";
import { callPythonService } from "./python-service-client";

// SECTION: Pont de logs Python → Next. Les entrées du service Python (GET /logs?after=<id>)
// sont réinjectées dans le logger commun, avec origin "python".

const POLL_INTERVAL_MS = 2_000;
const pythonServiceLogger = createLogger("python-service");

interface PythonLogRecord {
  id: number;
  ts: string;
  level: string;
  logger: string;
  message: string;
  exception?: string | null;
  request_id?: string | null;
}

interface BridgeState {
  lastPythonLogId: number;
  pythonReachable: boolean | null;
  timer: NodeJS.Timeout | null;
  pulling: Promise<void> | null;
  pythonBootId: string | null;
}

const globalForBridge = globalThis as typeof globalThis & { __etceteraPythonLogBridge?: BridgeState };
const bridgeState: BridgeState = (globalForBridge.__etceteraPythonLogBridge ??= {
  lastPythonLogId: 0,
  pythonReachable: null,
  timer: null,
  pulling: null,
  pythonBootId: null,
});

const PYTHON_LOGGER_TO_SOURCE: Record<string, LogSource> = {
  chatterbox: "chatterbox",
  whisper: "whisper",
  sherpa: "sherpa",
};

function toLogLevel(pythonLevel: string): LogLevel {
  const level = pythonLevel.toLowerCase();
  if (level === "warning") return "warn";
  if (level === "error" || level === "critical") return "error";
  if (level === "debug") return "debug";
  return "info";
}

function markReachability(reachable: boolean) {
  if (bridgeState.pythonReachable === reachable) return;
  const previous = bridgeState.pythonReachable;
  bridgeState.pythonReachable = reachable;
  // NOTE: une seule entrée par changement d'état, pas une par tentative.
  if (!reachable) pythonServiceLogger.warn("service.unreachable", "Service Python injoignable, ses logs ne sont plus collectés.");
  else if (previous === false) pythonServiceLogger.info("service.reachable", "Service Python de nouveau joignable.");
}

async function pullPythonLogsOnce(): Promise<void> {
  try {
    const response = await callPythonService(`/logs?after=${bridgeState.lastPythonLogId}`, { timeoutMs: 1_500 });
    const payload = (await response.json()) as { boot_id?: string; entries: PythonLogRecord[] };
    markReachability(true);

    // NOTE: redémarrage du service Python = compteur remis à zéro, on repart du début.
    if (payload.boot_id && payload.boot_id !== bridgeState.pythonBootId) {
      const isRestart = bridgeState.pythonBootId !== null;
      bridgeState.pythonBootId = payload.boot_id;
      if (isRestart && bridgeState.lastPythonLogId > 0) {
        bridgeState.lastPythonLogId = 0;
        return pullPythonLogsOnce();
      }
    }

    for (const record of payload.entries) {
      bridgeState.lastPythonLogId = Math.max(bridgeState.lastPythonLogId, record.id);
      writeLog({
        level: toLogLevel(record.level),
        source: PYTHON_LOGGER_TO_SOURCE[record.logger] ?? "python-service",
        origin: "python",
        event: `python.${record.logger}`,
        message: record.message,
        ts: record.ts,
        requestId: record.request_id ?? undefined,
        error: record.exception ? { name: "PythonException", message: record.exception.split("\n").at(-2) ?? record.message, stack: record.exception } : undefined,
      });
    }
  } catch {
    markReachability(false);
  }
}

/** Récupère immédiatement les nouveaux logs Python (sans parallélisme). */
export function syncPythonLogs(): Promise<void> {
  if (!bridgeState.pulling) {
    bridgeState.pulling = pullPythonLogsOnce().finally(() => {
      bridgeState.pulling = null;
    });
  }
  return bridgeState.pulling;
}

/** Démarre la collecte périodique tant qu'au moins un client SSE écoute. */
export function ensurePythonLogPolling(): void {
  if (bridgeState.timer) return;
  bridgeState.timer = setInterval(() => {
    if (countLogSubscribers() === 0) {
      clearInterval(bridgeState.timer!);
      bridgeState.timer = null;
      return;
    }
    void syncPythonLogs();
  }, POLL_INTERVAL_MS);
  void syncPythonLogs();
}
