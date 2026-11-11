import { NextResponse } from "next/server";
import { parseJsonBody, requireFound, withApiHandler } from "@/lib/server/core/api-handler";
import { setSttScore } from "@/lib/server/history/stt-history-repository";
import { scoreBodySchema } from "@/lib/server/history/score-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PUT = withApiHandler<{ id: string }>("/api/stt/history/[id]/score", async (request, { params }) => {
  const { score } = await parseJsonBody(request, scoreBodySchema);
  return NextResponse.json(requireFound(setSttScore(params.id, score), "Entrée d'historique"));
});
