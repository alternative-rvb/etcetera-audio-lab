import "server-only";
import { EventEmitter } from "node:events";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { LogEntry, LogLevel, LogOrigin, LogSource, SerializedError } from "@/lib/shared/types";
import { LOG_LEVELS } from "@/lib/shared/types";
import { PROJECT_PATHS } from "./paths";
import { getRequestContext } from "./request-context";

// SECTION: Logger structuré commun à tous les providers.
// - buffer mémoire circulaire (consultation rapide + flux SSE)
// - fichier JSONL persistant (output/logs/app.jsonl) avec rotation
// - requestId injecté automatiquement depuis le contexte de requête

const MAX_BUFFERED_ENTRIES = 2000;
const MAX_LOG_FILE_BYTES = 5 * 1024 * 1024;
const LOG_FILE = join(PROJECT_PATHS.logsDir, "app.jsonl");
const ROTATED_LOG_FILE = join(PROJECT_PATHS.logsDir, "app.1.jsonl");

interface LoggerState {
  buffer: LogEntry[];
  seq: number;
  emitter: EventEmitter;
  restoredFromDisk: boolean;
}

// NOTE: état stocké sur globalThis pour survivre au rechargement à chaud (HMR) de Next en dev.
const globalForLogger = globalThis as typeof globalThis & { __etceteraLogger?: LoggerState };

function getState(): LoggerState {
  if (!globalForLogger.__etceteraLogger) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(100);
    globalForLogger.__etceteraLogger = { buffer: [], seq: 0, emitter, restoredFromDisk: false };
  }
  const state = globalForLogger.__etceteraLogger;
  if (!state.restoredFromDisk) {
    state.restoredFromDisk = true;
    restoreFromDisk(state);
  }
  return state;
}

function restoreFromDisk(state: LoggerState) {
  try {
    if (!existsSync(LOG_FILE)) return;
    const lines = readFileSync(LOG_FILE, "utf-8").trim().split("\n").slice(-MAX_BUFFERED_ENTRIES);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as LogEntry;
        state.buffer.push(entry);
        state.seq = Math.max(state.seq, entry.seq);
      } catch {
        // NOTE: ligne corrompue ignorée, le reste du fichier reste exploitable.
      }
    }
  } catch (err) {
    console.error("[logger] Lecture du fichier de logs impossible :", err);
  }
}

function persist(entry: LogEntry) {
  try {
    if (!existsSync(PROJECT_PATHS.logsDir)) mkdirSync(PROJECT_PATHS.logsDir, { recursive: true });
    if (existsSync(LOG_FILE) && statSync(LOG_FILE).size > MAX_LOG_FILE_BYTES) {
      if (existsSync(ROTATED_LOG_FILE)) unlinkSync(ROTATED_LOG_FILE);
      renameSync(LOG_FILE, ROTATED_LOG_FILE);
    }
    appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n", "utf-8");
  } catch (err) {
    // NOTE: un échec d'écriture disque ne doit jamais faire échouer la requête en cours.
    console.error("[logger] Écriture du fichier de logs impossible :", err);
  }
}

export function serializeError(err: unknown, depth = 0): SerializedError {
  if (err instanceof Error) {
    const withCode = err as Error & { code?: unknown; cause?: unknown };
    return {
      name: err.name,
      message: err.message,
      code: typeof withCode.code === "string" ? withCode.code : undefined,
      stack: err.stack,
      cause: withCode.cause !== undefined && depth < 3 ? serializeError(withCode.cause, depth + 1) : undefined,
    };
  }
  if (err && typeof err === "object" && "message" in err && typeof (err as SerializedError).message === "string") {
    // NOTE: erreur déjà sérialisée (logs Python, logs navigateur).
    const pre = err as SerializedError;
    return { name: pre.name ?? "Error", message: pre.message, code: pre.code, stack: pre.stack };
  }
  return { name: "NonError", message: typeof err === "string" ? err : JSON.stringify(err) };
}

export interface LogInput {
  level: LogLevel;
  source: LogSource;
  event: string;
  message: string;
  origin?: LogOrigin;
  requestId?: string;
  durationMs?: number;
  meta?: Record<string, unknown>;
  error?: unknown;
  ts?: string;
}

export function writeLog(input: LogInput): LogEntry {
  const state = getState();
  state.seq += 1;
  const entry: LogEntry = {
    id: `log_${state.seq}`,
    seq: state.seq,
    ts: input.ts ?? new Date().toISOString(),
    level: input.level,
    source: input.source,
    origin: input.origin ?? "node",
    event: input.event,
    message: input.message,
    requestId: input.requestId ?? getRequestContext()?.requestId,
    durationMs: input.durationMs,
    meta: input.meta,
    error: input.error === undefined ? undefined : serializeError(input.error),
  };

  state.buffer.push(entry);
  if (state.buffer.length > MAX_BUFFERED_ENTRIES) state.buffer.splice(0, state.buffer.length - MAX_BUFFERED_ENTRIES);

  persist(entry);
  mirrorToConsole(entry);
  state.emitter.emit("log", entry);
  return entry;
}

function mirrorToConsole(entry: LogEntry) {
  if (entry.level === "debug") return;
  const line = `[${entry.source}] ${entry.event} : ${entry.message}${entry.requestId ? ` (${entry.requestId})` : ""}`;
  if (entry.level === "error") console.error(line, entry.error?.stack ?? "");
  else if (entry.level === "warn") console.warn(line);
  else console.log(line);
}

type LogExtras = Omit<LogInput, "level" | "source" | "event" | "message">;

export interface ScopedLogger {
  debug(event: string, message: string, extras?: LogExtras): LogEntry;
  info(event: string, message: string, extras?: LogExtras): LogEntry;
  warn(event: string, message: string, extras?: LogExtras): LogEntry;
  error(event: string, message: string, extras?: LogExtras): LogEntry;
}

/** Logger dédié à une source (un provider, l'API, le système). */
export function createLogger(source: LogSource): ScopedLogger {
  const make = (level: LogLevel) => (event: string, message: string, extras: LogExtras = {}) =>
    writeLog({ ...extras, level, source, event, message });
  return { debug: make("debug"), info: make("info"), warn: make("warn"), error: make("error") };
}

// SECTION: Lecture, abonnement, purge

export interface LogQuery {
  sources?: LogSource[];
  minLevel?: LogLevel;
  requestId?: string;
  search?: string;
  afterSeq?: number;
  limit?: number;
}

export function matchesLogQuery(entry: LogEntry, query: LogQuery): boolean {
  if (query.sources?.length && !query.sources.includes(entry.source)) return false;
  if (query.minLevel && LOG_LEVELS.indexOf(entry.level) < LOG_LEVELS.indexOf(query.minLevel)) return false;
  if (query.requestId && entry.requestId !== query.requestId) return false;
  if (query.afterSeq !== undefined && entry.seq <= query.afterSeq) return false;
  if (query.search) {
    const needle = query.search.toLowerCase();
    const haystack = `${entry.event} ${entry.message} ${entry.error?.message ?? ""} ${entry.requestId ?? ""}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

export function queryLogs(query: LogQuery = {}): LogEntry[] {
  const limit = query.limit ?? 500;
  return getState()
    .buffer.filter((entry) => matchesLogQuery(entry, query))
    .slice(-limit);
}

export function subscribeToLogs(listener: (entry: LogEntry) => void): () => void {
  const { emitter } = getState();
  emitter.on("log", listener);
  return () => emitter.off("log", listener);
}

export function countLogSubscribers(): number {
  return getState().emitter.listenerCount("log");
}

export function clearLogs(): void {
  const state = getState();
  state.buffer = [];
  try {
    if (existsSync(LOG_FILE)) unlinkSync(LOG_FILE);
    if (existsSync(ROTATED_LOG_FILE)) unlinkSync(ROTATED_LOG_FILE);
  } catch (err) {
    console.error("[logger] Suppression des fichiers de logs impossible :", err);
  }
}
