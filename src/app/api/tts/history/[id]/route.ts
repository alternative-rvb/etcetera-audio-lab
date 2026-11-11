import { NextResponse } from "next/server";
import { requireFound, withApiHandler } from "@/lib/server/core/api-handler";
import { deleteTtsHistoryEntry } from "@/lib/server/history/tts-history-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = withApiHandler<{ id: string }>("/api/tts/history/[id]", async (_request, { params }) => {
  requireFound(deleteTtsHistoryEntry(params.id) || null, "Entrée d'historique");
  return NextResponse.json({ ok: true });
});
