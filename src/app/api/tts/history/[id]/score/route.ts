import { NextResponse } from "next/server";
import { parseJsonBody, requireFound, withApiHandler } from "@/lib/server/core/api-handler";
import { setTtsScore } from "@/lib/server/history/tts-history-repository";
import { scoreBodySchema } from "@/lib/server/history/score-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PUT = withApiHandler<{ id: string }>("/api/tts/history/[id]/score", async (request, { params }) => {
  const { score } = await parseJsonBody(request, scoreBodySchema);
  return NextResponse.json(requireFound(setTtsScore(params.id, score), "Entrée d'historique"));
});
