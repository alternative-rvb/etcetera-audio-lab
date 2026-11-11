import { NextResponse } from "next/server";
import { parseJsonBody, withApiHandler } from "@/lib/server/core/api-handler";
import { runTtsSynthesis, ttsSynthesisRequestSchema } from "@/lib/server/providers/tts/tts-synthesis-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ANCHOR: POST /api/tts → synthèse avec le provider demandé, renvoie l'entrée d'historique (l'audio est servi par /audio).
export const POST = withApiHandler("/api/tts", async (request) => {
  const body = await parseJsonBody(request, ttsSynthesisRequestSchema);
  const { entry } = await runTtsSynthesis(body, request.signal);
  return NextResponse.json({ entry });
});
