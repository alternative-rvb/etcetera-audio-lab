import { NextResponse } from "next/server";
import { requireFound, withApiHandler } from "@/lib/server/core/api-handler";
import { createLogger } from "@/lib/server/core/logger";
import { getSttEntry, setSttAnalysis } from "@/lib/server/history/stt-history-repository";
import { analyzeSttText } from "@/lib/server/providers/stt/analysis/stt-analysis-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const logger = createLogger("groq");

// ANCHOR: analyse (ou nouvelle analyse) de la qualité du texte d'une transcription par Groq ; la note manuelle n'est pas touchée.
export const POST = withApiHandler<{ id: string }>("/api/stt/history/[id]/analyze", async (request, { params }) => {
  const entry = requireFound(getSttEntry(params.id), "Entrée d'historique");
  const startedAt = performance.now();
  const analysis = await analyzeSttText(entry, request.signal);
  const saved = requireFound(setSttAnalysis(entry.id, analysis), "Entrée d'historique");
  logger.info("analysis.done", `Analyse ${analysis.score}/3 du texte ${entry.provider} (${entry.text.length} caractères).`, {
    durationMs: Math.round(performance.now() - startedAt),
    meta: { model: analysis.model, criteria: analysis.criteria, suspectWords: analysis.suspectWords.length },
  });
  return NextResponse.json(saved);
});
