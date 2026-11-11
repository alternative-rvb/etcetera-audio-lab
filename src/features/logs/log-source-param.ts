import { LOG_SOURCES, type LogSource } from "@/lib/shared/types";

// ANCHOR: lecture sûre du paramètre d'URL ?sources= (utilisée côté serveur par la page /logs).
export function parseLogSource(value: string | undefined): LogSource | null {
  return value && (LOG_SOURCES as readonly string[]).includes(value) ? (value as LogSource) : null;
}
