"use client";

import type { LogLevel } from "@/lib/shared/types";

// SECTION: Envoi des événements navigateur (micro, Web Speech, AudioContext, erreurs de rendu) vers /api/logs.

type BrowserLogSource = "browser" | "web-speech" | "edge-tts" | "piper" | "kokoro" | "chatterbox" | "whisper" | "sherpa";

export function reportBrowserLog(
  level: LogLevel,
  source: BrowserLogSource,
  event: string,
  message: string,
  extras: { error?: unknown; meta?: Record<string, unknown>; requestId?: string } = {}
) {
  const error =
    extras.error instanceof Error
      ? { name: extras.error.name, message: extras.error.message, stack: extras.error.stack?.slice(0, 8000) }
      : extras.error !== undefined
        ? { name: "Error", message: String(extras.error) }
        : undefined;

  // NOTE: fire-and-forget, un échec d'envoi de log ne doit jamais casser l'interface.
  void fetch("/api/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ level, source, event, message, error, meta: extras.meta, requestId: extras.requestId }),
    keepalive: true,
  }).catch(() => undefined);
}
