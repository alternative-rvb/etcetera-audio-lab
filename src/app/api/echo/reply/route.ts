import { NextResponse } from "next/server";
import { parseJsonBody, withApiHandler } from "@/lib/server/core/api-handler";
import { createLogger } from "@/lib/server/core/logger";
import { echoReplyRequestSchema, replyToEcho } from "@/lib/server/providers/llm/echo-reply-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const logger = createLogger("groq");

// ANCHOR: POST /api/echo/reply → réponse de Groq à la phrase transcrite (mode Réponse IA de la page Écho).
// NOTE: le log garde les longueurs et le modèle, jamais le contenu de la conversation.
export const POST = withApiHandler("/api/echo/reply", async (request) => {
  const body = await parseJsonBody(request, echoReplyRequestSchema);
  const startedAt = performance.now();
  const { reply, model } = await replyToEcho(body, request.signal);
  const processingTimeMs = Math.round(performance.now() - startedAt);
  logger.info("echo.reply", `Réponse IA de ${reply.length} caractères à une phrase de ${body.text.length} caractères (${body.history.length} tour(s) en mémoire).`, {
    durationMs: processingTimeMs,
    meta: { model, historyTurns: body.history.length },
  });
  return NextResponse.json({ reply, model, processingTimeMs });
});
