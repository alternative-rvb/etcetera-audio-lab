import "server-only";
import { AppError } from "@/lib/server/core/errors";
import { GROQ_API_BASE, GROQ_KEY_HINT, readGroqApiKey, readGroqError } from "@/lib/server/core/groq-api";

// SECTION: Client minimal de l'API Groq Chat Completions (compatible OpenAI), sortie JSON contrainte par un schéma.
// LINK: https://console.groq.com/docs/structured-outputs

/** Modèle de l'analyse ; surchargeable par GROQ_ANALYSIS_MODEL dans .env.local si Groq retire celui-ci. */
export const GROQ_ANALYSIS_MODEL = process.env.GROQ_ANALYSIS_MODEL?.trim() || "openai/gpt-oss-20b";
const GROQ_CHAT_TIMEOUT_MS = 30_000;

export interface GroqJsonRequest {
  system: string;
  user: string;
  schemaName: string;
  /** JSON Schema de la réponse (mode strict : additionalProperties false et tous les champs requis). */
  schema: Record<string, unknown>;
  signal?: AbortSignal;
}

/** Renvoie le JSON déjà parsé de la réponse ; la validation métier reste à la charge de l'appelant (zod). */
export async function groqJsonCompletion(request: GroqJsonRequest): Promise<{ data: unknown; model: string }> {
  const apiKey = readGroqApiKey();
  if (!apiKey) throw new AppError("ENGINE_UNAVAILABLE", "Clé API Groq absente.", { provider: "groq", hint: GROQ_KEY_HINT });

  const signal = request.signal ? AbortSignal.any([request.signal, AbortSignal.timeout(GROQ_CHAT_TIMEOUT_MS)]) : AbortSignal.timeout(GROQ_CHAT_TIMEOUT_MS);
  const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_ANALYSIS_MODEL,
      temperature: 0,
      // NOTE: marge pour les jetons de raisonnement du modèle, comptés dans la limite de sortie.
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
      response_format: { type: "json_schema", json_schema: { name: request.schemaName, strict: true, schema: request.schema } },
    }),
    signal,
  });

  if (!response.ok) {
    const message = await readGroqError(response);
    if (response.status === 401) throw new AppError("ENGINE_UNAVAILABLE", `Clé API Groq refusée : ${message}`, { provider: "groq", hint: GROQ_KEY_HINT });
    if (response.status === 429) {
      throw new AppError("ENGINE_FAILED", `Quota Groq atteint : ${message}`, { provider: "groq", status: 429, hint: "Patientez quelques secondes puis relancez l'analyse." });
    }
    throw new AppError("ENGINE_FAILED", `Groq a refusé l'analyse : ${message}`, {
      provider: "groq",
      details: { status: response.status, model: GROQ_ANALYSIS_MODEL },
      hint: response.status === 400 || response.status === 404 ? "Modèle indisponible ? Définissez GROQ_ANALYSIS_MODEL dans .env.local." : undefined,
    });
  }

  const body = (await response.json()) as { model?: string; choices?: Array<{ message?: { content?: string | null } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new AppError("ENGINE_FAILED", "Groq a renvoyé une réponse vide.", { provider: "groq" });
  try {
    return { data: JSON.parse(content), model: body.model ?? GROQ_ANALYSIS_MODEL };
  } catch (err) {
    throw new AppError("ENGINE_FAILED", "Groq a renvoyé un JSON illisible.", { provider: "groq", cause: err });
  }
}
