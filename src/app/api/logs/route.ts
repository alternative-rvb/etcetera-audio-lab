import { NextResponse } from "next/server";
import { z } from "zod";
import { LOG_LEVELS } from "@/lib/shared/types";
import { parseJsonBody, withApiHandler } from "@/lib/server/core/api-handler";
import { AppError } from "@/lib/server/core/errors";
import { clearLogs, queryLogs, writeLog } from "@/lib/server/core/logger";
import { syncPythonLogs } from "@/lib/server/core/python-log-bridge";
import { parseLogQuery } from "@/lib/server/logs-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  "/api/logs",
  async (request) => {
    await syncPythonLogs();
    return NextResponse.json(queryLogs(parseLogQuery(request.nextUrl.searchParams)));
  },
  { quiet: true }
);

// SECTION: Réception des logs du navigateur (micro, Web Speech, AudioContext, erreurs de rendu).

const BROWSER_LOG_SOURCES = ["browser", "web-speech", "edge-tts", "piper", "kokoro", "chatterbox", "whisper", "sherpa"] as const;
const browserLogSchema = z.object({
  level: z.enum(LOG_LEVELS),
  source: z.enum(BROWSER_LOG_SOURCES),
  event: z.string().min(1).max(80),
  message: z.string().min(1).max(2000),
  requestId: z.string().max(64).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  error: z.object({ name: z.string(), message: z.string(), stack: z.string().max(8000).optional() }).optional(),
});

const BROWSER_LOG_LIMIT_PER_MINUTE = 120;
let browserLogWindow = { startedAt: Date.now(), count: 0 };

export const POST = withApiHandler(
  "/api/logs",
  async (request) => {
    if (Date.now() - browserLogWindow.startedAt > 60_000) browserLogWindow = { startedAt: Date.now(), count: 0 };
    browserLogWindow.count += 1;
    if (browserLogWindow.count > BROWSER_LOG_LIMIT_PER_MINUTE) {
      throw new AppError("VALIDATION", "Trop de logs navigateur envoyés, réessayez dans une minute.", { status: 429 });
    }
    const body = await parseJsonBody(request, browserLogSchema);
    const entry = writeLog({ ...body, origin: "browser" });
    return NextResponse.json({ id: entry.id });
  },
  { quiet: true }
);

export const DELETE = withApiHandler("/api/logs", async () => {
  clearLogs();
  writeLog({ level: "info", source: "system", event: "logs.cleared", message: "Logs vidés depuis l'interface." });
  return NextResponse.json({ ok: true });
});
