import "server-only";
import { z } from "zod";
import { STT_PROVIDER_IDS, TTS_PROVIDER_IDS } from "@/lib/shared/types";
import { STT_PROVIDER_CATALOG, TTS_PROVIDER_CATALOG } from "@/lib/shared/provider-catalog";
import { AppError } from "@/lib/server/core/errors";
import { groqTextCompletion, type GroqChatMessage } from "./groq-chat-client";

// SECTION: Réponse IA de la page Écho : Groq répond à la phrase transcrite, avec le contexte de la conversation et des mesures.

export const ECHO_MAX_HISTORY = 10;
const MAX_TEXT_CHARS = 2_000;

const engines = {
  sttProvider: z.enum(STT_PROVIDER_IDS),
  ttsProvider: z.enum(TTS_PROVIDER_IDS),
  voiceName: z.string().max(120),
};

const ms = z.number().min(0).max(3_600_000);

export const echoReplyRequestSchema = z.object({
  text: z.string().max(MAX_TEXT_CHARS),
  current: z.object(engines),
  history: z
    .array(
      z.object({
        ...engines,
        user: z.string().max(MAX_TEXT_CHARS),
        assistant: z.string().max(MAX_TEXT_CHARS),
        times: z.object({ sttMs: ms, llmMs: ms, ttsMs: ms, latencyMs: ms, totalMs: ms }),
      })
    )
    .max(ECHO_MAX_HISTORY),
});

export type EchoReplyRequest = z.infer<typeof echoReplyRequestSchema>;

const SYSTEM_PROMPT = `Tu es l'assistant vocal d'un banc d'essai de synthèse vocale (TTS) et de reconnaissance vocale (STT) en français.
La personne te parle au micro : sa phrase est transcrite par un moteur STT, tu réponds, puis ta réponse est lue à voix haute par un moteur TTS.
Règles :
- Réponds en français, comme à l'oral, en 1 à 3 phrases courtes. Pas de Markdown, de liste, d'emoji ni de caractère spécial : tout est lu à voix haute.
- Le texte reçu vient d'une transcription automatique et peut contenir des erreurs de reconnaissance. Si le sens est douteux, dis ce que tu as compris et demande de reformuler.
- Chaque message de la personne commence par une ligne [contexte] avec les moteurs utilisés et, pour les tours précédents, les temps mesurés. Sers-t'en seulement si on t'interroge sur la qualité, la compréhension ou la rapidité des échanges ; ne recopie jamais cette ligne.
- Pour parler des temps, arrondis au dixième de seconde et compare-les aux tours précédents.`;

const seconds = (value: number) => `${(value / 1000).toFixed(1)} s`;
const sttLabel = (id: EchoReplyRequest["current"]["sttProvider"]) => STT_PROVIDER_CATALOG[id]?.label ?? id;
const ttsLabel = (id: EchoReplyRequest["current"]["ttsProvider"]) => TTS_PROVIDER_CATALOG[id]?.label ?? id;

function contextLine(turn: EchoReplyRequest["current"], times?: EchoReplyRequest["history"][number]["times"]): string {
  const engineText = `STT ${sttLabel(turn.sttProvider)}, TTS ${ttsLabel(turn.ttsProvider)} (voix ${turn.voiceName || "inconnue"})`;
  if (!times) return `[contexte] ${engineText}, tour en cours.`;
  return `[contexte] ${engineText}. Transcription ${seconds(times.sttMs)}, réflexion IA ${seconds(times.llmMs)}, synthèse ${seconds(times.ttsMs)}, réponse entendue ${seconds(times.latencyMs)} après la fin de la phrase, tour complet ${seconds(times.totalMs)}.`;
}

export async function replyToEcho(request: EchoReplyRequest, signal?: AbortSignal): Promise<{ reply: string; model: string }> {
  const text = request.text.trim();
  if (!text) throw new AppError("VALIDATION", "Aucune phrase à laquelle répondre : la transcription est vide.", { provider: "groq" });

  const messages: GroqChatMessage[] = request.history.flatMap((turn): GroqChatMessage[] => [
    { role: "user", content: `${contextLine(turn, turn.times)}\n${turn.user}` },
    { role: "assistant", content: turn.assistant },
  ]);
  messages.push({ role: "user", content: `${contextLine(request.current)}\n${text}` });

  const { text: reply, model } = await groqTextCompletion({ system: SYSTEM_PROMPT, messages, signal });
  return { reply, model };
}
