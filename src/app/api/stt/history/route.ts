import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/server/core/api-handler";
import { createLogger } from "@/lib/server/core/logger";
import { clearSttHistory, listSttHistory } from "@/lib/server/history/stt-history-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler("/api/stt/history", async () => NextResponse.json(listSttHistory()), { quiet: true });

export const DELETE = withApiHandler("/api/stt/history", async () => {
  const removed = clearSttHistory();
  createLogger("system").info("history.cleared", `Historique STT vidé (${removed} entrée(s)).`);
  return NextResponse.json({ ok: true, removed });
});
