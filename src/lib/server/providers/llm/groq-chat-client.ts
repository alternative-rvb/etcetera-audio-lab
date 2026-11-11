import "server-only";
import { AppError } from "@/lib/server/core/errors";
import { GROQ_API_BASE, GROQ_KEY_HINT, readGroqApiKey, readGroqError } from "@/lib/server/core/groq-api";

// SECTION: Client minimal de l'API Groq Chat Completions (compatible OpenAI) : sortie JSON contrainte par un schéma, ou texte libre.
// LINK: https://console.groq.com/docs/structured-outputs

/** Modèle de l'analyse ; surchargeable par GROQ_ANALYSIS_MODEL dans .env.local si Groq retire celui-ci. */
export const GROQ_ANALYSIS_MODEL = process.env.GROQ_ANALYSIS_MODEL?.trim() || "openai/gpt-oss-20b";
/** Modèle des réponses de la page Écho ; surchargeable par GROQ_REPLY_MODEL, sinon le même que l'analyse. */
export const GROQ_REPLY_MODEL = process.env.GROQ_REPLY_MODEL?.trim() || GROQ_ANALYSIS_MODEL;
const GROQ_CHAT_TIMEOUT_MS = 30_000;

export interface GroqChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqJsonRequest {
  system: string;
  user: string;
  schemaName: string;
  /** JSON Schema de la réponse (mode strict : additionalProperties false et tous les champs requis). */
  schema: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface GroqTextRequest {
  system: string;
  /** Échanges précédents puis message courant, dans l'ordre chronologique. */
  messages: GroqChatMessage[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

/** Appel commun : clé, délai, erreurs normalisées ; renvoie le contenu texte du premier choix. */
async function groqChatCompletion(model: string, body: Record<string, unknown>, signal: AbortSignal | undefined, action: string): Promise<{ content: string; model: string }> {
  const apiKey = readGroqApiKey();
  if (!apiKey) throw new AppError("ENGINE_UNAVAILABLE", "Clé API Groq absente.", { provider: "groq", hint: GROQ_KEY_HINT });

  const timeout = AbortSignal.timeout(GROQ_CHAT_TIMEOUT_MS);
  const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      // NOTE: effort de raisonnement réduit sur les modèles gpt-oss, sinon la réflexion allonge nettement la latence.
      ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
      ...body,
    }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });

  if (!response.ok) {
    const message = await readGroqError(response);
    if (response.status === 401) throw new AppError("ENGINE_UNAVAILABLE", `Clé API Groq refusée : ${message}`, { provider: "groq", hint: GROQ_KEY_HINT });
    if (response.status === 429) {
      throw new AppError("ENGINE_FAILED", `Quota Groq atteint : ${message}`, { provider: "groq", status: 429, hint: "Patientez quelques secondes puis relancez." });
    }
    throw new AppError("ENGINE_FAILED", `Groq a refusé ${action} : ${message}`, {
      provider: "groq",
      details: { status: response.status, model },
      hint: response.status === 400 || response.status === 404 ? "Modèle indisponible ? Définissez GROQ_ANALYSIS_MODEL ou GROQ_REPLY_MODEL dans .env.local." : undefined,
    });
  }

  const json = (await response.json()) as { model?: string; choices?: Array<{ message?: { content?: string | null } }> };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new AppError("ENGINE_FAILED", "Groq a renvoyé une réponse vide.", { provider: "groq", hint: "Relancez ; si le problème persiste, essayez un autre modèle dans .env.local." });
  return { content, model: json.model ?? model };
}

/** Renvoie le JSON déjà parsé de la réponse ; la validation métier reste à la charge de l'appelant (zod). */
export async function groqJsonCompletion(request: GroqJsonRequest): Promise<{ data: unknown; model: string }> {
  const { content, model } = await groqChatCompletion(
    GROQ_ANALYSIS_MODEL,
    {
      temperature: 0,
      // NOTE: marge pour les jetons de raisonnement du modèle, comptés dans la limite de sortie.
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
      response_format: { type: "json_schema", json_schema: { name: request.schemaName, strict: true, schema: request.schema } },
    },
    request.signal,
    "l'analyse"
  );
  try {
    return { data: JSON.parse(content), model };
  } catch (err) {
    throw new AppError("ENGINE_FAILED", "Groq a renvoyé un JSON illisible.", { provider: "groq", cause: err });
  }
}

/** Réponse en texte libre (conversation). */
export async function groqTextCompletion(request: GroqTextRequest): Promise<{ text: string; model: string }> {
  const { content, model } = await groqChatCompletion(
    GROQ_REPLY_MODEL,
    {
      temperature: request.temperature ?? 0.6,
      max_completion_tokens: request.maxTokens ?? 512,
      messages: [{ role: "system", content: request.system }, ...request.messages],
    },
    request.signal,
    "la réponse"
  );
  return { text: content, model };
}
