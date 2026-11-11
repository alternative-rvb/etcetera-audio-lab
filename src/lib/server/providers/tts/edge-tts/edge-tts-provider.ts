import "server-only";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { z } from "zod";
import { AppError } from "@/lib/server/core/errors";
import { createLogger } from "@/lib/server/core/logger";
import { withTimeout } from "@/lib/server/core/timeout";
import { filterVoicesByLocale } from "../tts-voice-utils";
import type { TtsProvider } from "../tts-provider.types";
import { EDGE_TTS_VOICES } from "./edge-tts-voices";

// SECTION: Provider Edge TTS (endpoint gratuit des voix Microsoft Edge Neural, via msedge-tts).
// NOTE: msedge-tts remplace edge-tts-universal 1.4.0 depuis le 2026-11-11 (backlog id 24) : Microsoft a déplacé la
// synthèse vers api.msedgeservices.com et l'ancienne lib restait pendante sur l'ancien hôte (403 au handshake).

const edgeTtsLogger = createLogger("edge-tts");
const EDGE_TTS_TIMEOUT_MS = 30_000;
const EDGE_TTS_MAX_ATTEMPTS = 2;

function formatRate(ratePercent: number): string | undefined {
  if (ratePercent === 0) return undefined;
  return `${ratePercent >= 0 ? "+" : ""}${ratePercent}%`;
}

async function synthesizeEdgeAudio(text: string, voiceId: string, rate: string | undefined): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text, rate ? { rate } : undefined);
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  } finally {
    tts.close();
  }
}

function isRetryableNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /websocket|network|stream closed|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up/i.test(err.message);
}

export const edgeTtsProvider: TtsProvider<"edge-tts"> = {
  id: "edge-tts",

  settingsSchema: z.object({
    ratePercent: z.number().int().min(-50).max(50),
  }),

  async listVoices(locale) {
    return { provider: "edge-tts", voices: filterVoicesByLocale(EDGE_TTS_VOICES, locale) };
  },

  async synthesize({ text, voiceId, settings }) {
    const voice = EDGE_TTS_VOICES.find((v) => v.id === voiceId);
    if (!voice) {
      throw new AppError("VOICE_NOT_FOUND", `Voix Edge TTS inconnue : ${voiceId}.`, { provider: "edge-tts" });
    }

    const rate = formatRate(settings.ratePercent);
    let lastError: unknown;
    for (let attempt = 1; attempt <= EDGE_TTS_MAX_ATTEMPTS; attempt++) {
      try {
        const buffer = await withTimeout(synthesizeEdgeAudio(text, voiceId, rate), EDGE_TTS_TIMEOUT_MS, "Edge TTS");
        if (buffer.length === 0) {
          throw new AppError("ENGINE_FAILED", "Edge TTS a renvoyé un audio vide.", { provider: "edge-tts" });
        }
        return { audio: buffer, format: "mp3", voiceName: voice.name, diagnostics: { attempt, rate: rate ?? "+0%" } };
      } catch (err) {
        lastError = err;
        if (attempt < EDGE_TTS_MAX_ATTEMPTS && isRetryableNetworkError(err)) {
          edgeTtsLogger.warn("synthesis.retry", `Erreur réseau, nouvelle tentative (${attempt + 1}/${EDGE_TTS_MAX_ATTEMPTS}).`, {
            error: err,
          });
          continue;
        }
        break;
      }
    }

    if (lastError instanceof AppError) throw lastError;
    // NOTE: garde-fou si l'endpoint non documenté change encore sans prévenir (cf. panne d'octobre 2026, backlog id 24).
    if (lastError instanceof Error && lastError.name === "TimeoutError") {
      throw new AppError("TIMEOUT", `Edge TTS n'a pas répondu en ${EDGE_TTS_TIMEOUT_MS / 1000} s.`, {
        provider: "edge-tts",
        hint: "L'endpoint Microsoft (non officiel) ne renvoie aucun audio. Vérifiez la connexion, puis une éventuelle mise à jour de msedge-tts (Microsoft change parfois l'hôte ou le jeton).",
        cause: lastError,
      });
    }
    throw new AppError("ENGINE_FAILED", "Le service Microsoft Edge TTS n'a pas pu produire l'audio.", {
      provider: "edge-tts",
      hint: "Vérifiez la connexion Internet. L'endpoint Edge est non officiel et peut refuser temporairement les requêtes.",
      cause: lastError,
    });
  },

  async checkHealth() {
    // NOTE: pas d'appel réseau ici pour ne pas solliciter l'endpoint Microsoft à chaque vérification.
    return { status: "ok", details: { voices: EDGE_TTS_VOICES.length, network: "requis, non vérifié" } };
  },
};
