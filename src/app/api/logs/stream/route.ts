import type { NextRequest } from "next/server";
import type { LogEntry } from "@/lib/shared/types";
import { matchesLogQuery, subscribeToLogs } from "@/lib/server/core/logger";
import { ensurePythonLogPolling } from "@/lib/server/core/python-log-bridge";
import { parseLogQuery } from "@/lib/server/logs-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_INTERVAL_MS = 15_000;

// ANCHOR: GET /api/logs/stream → flux Server-Sent Events des nouveaux logs (mêmes filtres que /api/logs).
export async function GET(request: NextRequest) {
  const query = parseLogQuery(request.nextUrl.searchParams);
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const unsubscribe = subscribeToLogs((entry: LogEntry) => {
        if (matchesLogQuery(entry, { ...query, afterSeq: undefined })) send(`id: ${entry.seq}\ndata: ${JSON.stringify(entry)}\n\n`);
      });
      const heartbeat = setInterval(() => send(`: heartbeat\n\n`), HEARTBEAT_INTERVAL_MS);
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // NOTE: flux déjà fermé.
        }
      });
      send(`retry: 3000\n\n`);
      ensurePythonLogPolling();
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
