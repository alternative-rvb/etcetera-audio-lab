import "server-only";
import { z } from "zod";
import type { SttAnalysis, SttHistoryEntry } from "@/lib/shared/types";
import { AppError } from "@/lib/server/core/errors";
import { groqJsonCompletion } from "../../llm/groq-chat-client";

// SECTION: Analyse de la qualité d'un texte transcrit par un LLM (Groq).
// NOTE: sans texte de référence, le LLM juge la lisibilité et la cohérence du texte, pas son exactitude réelle par rapport à l'audio.

const MAX_ANALYZED_CHARS = 8_000;

const criterion = z.number().int().min(1).max(3);
const analysisSchema = z.object({
  score: criterion,
  criteria: z.object({ ponctuation: criterion, coherence: criterion, fluidite: criterion }),
  suspectWords: z.array(z.string()).max(12),
  summary: z.string().max(400),
});

// ANCHOR: schéma JSON du mode strict de Groq, miroir de analysisSchema (zod reste la validation de référence).
const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", enum: [1, 2, 3] },
    criteria: {
      type: "object",
      properties: {
        ponctuation: { type: "integer", enum: [1, 2, 3] },
        coherence: { type: "integer", enum: [1, 2, 3] },
        fluidite: { type: "integer", enum: [1, 2, 3] },
      },
      required: ["ponctuation", "coherence", "fluidite"],
      additionalProperties: false,
    },
    suspectWords: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
  required: ["score", "criteria", "suspectWords", "summary"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `Tu évalues la qualité d'un texte produit par un moteur de reconnaissance vocale. Tu n'as pas l'audio ni le texte de référence : tu juges uniquement le texte.
Barème de 1 à 3 pour chaque critère (1 = mauvais, 2 = correct, 3 = très bon) :
- ponctuation : majuscules, points, virgules, apostrophes, accents.
- coherence : le texte a-t-il du sens, les mots s'enchaînent-ils logiquement dans la langue indiquée.
- fluidite : phrases complètes et naturelles, sans mots tronqués, répétitions ou fragments absurdes.
"score" est la note globale de 1 à 3. "suspectWords" liste les mots ou groupes de mots qui semblent mal reconnus (maximum 12, vide si aucun). "summary" tient en une ou deux phrases en français. Réponds uniquement avec le JSON demandé.`;

export async function analyzeSttText(entry: Pick<SttHistoryEntry, "text" | "language" | "provider">, signal?: AbortSignal): Promise<SttAnalysis> {
  const text = entry.text.trim();
  if (!text) throw new AppError("VALIDATION", "Aucun texte à analyser : la transcription est vide.", { provider: "groq" });

  const { data, model } = await groqJsonCompletion({
    system: SYSTEM_PROMPT,
    user: `Langue attendue : ${entry.language}. Moteur : ${entry.provider}.\nTexte transcrit :\n"""\n${text.slice(0, MAX_ANALYZED_CHARS)}\n"""`,
    schemaName: "stt_quality_analysis",
    schema: RESPONSE_JSON_SCHEMA,
    signal,
  });

  const parsed = analysisSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppError("ENGINE_FAILED", "La réponse de l'analyse ne respecte pas le format attendu.", { provider: "groq", details: parsed.error.issues, cause: parsed.error });
  }
  return { ...parsed.data, model, analyzedAt: new Date().toISOString() };
}
