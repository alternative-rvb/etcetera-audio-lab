import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/server/core/api-handler";
import { createLogger } from "@/lib/server/core/logger";
import { clearTtsHistory, listTtsHistory } from "@/lib/server/history/tts-history-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler("/api/tts/history", async () => NextResponse.json(listTtsHistory()), { quiet: true });

export const DELETE = withApiHandler("/api/tts/history", async () => {
  const removed = clearTtsHistory();
  createLogger("system").info("history.cleared", `Historique TTS vidé (${removed} entrée(s)).`);
  return NextResponse.json({ ok: true, removed });
});
