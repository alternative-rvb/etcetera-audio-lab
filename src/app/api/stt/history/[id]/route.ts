import { NextResponse } from "next/server";
import { requireFound, withApiHandler } from "@/lib/server/core/api-handler";
import { deleteSttHistoryEntry } from "@/lib/server/history/stt-history-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = withApiHandler<{ id: string }>("/api/stt/history/[id]", async (_request, { params }) => {
  requireFound(deleteSttHistoryEntry(params.id) || null, "Entrée d'historique");
  return NextResponse.json({ ok: true });
});
