import "server-only";
import { z } from "zod";
import { TTS_PROVIDER_IDS, type TtsHistoryEntry, type TtsProviderId } from "@/lib/shared/types";
import { toAppError } from "@/lib/server/core/errors";
import { createLogger } from "@/lib/server/core/logger";
import { saveTtsAudio } from "@/lib/server/history/tts-history-repository";
import { getTtsProvider } from "./tts-provider-registry";

// SECTION: Orchestration d'une synthèse TTS, identique pour tous les providers :
// validation des réglages, appel du provider, traçage (début, fin, erreur), sauvegarde dans l'historique.

export const MAX_TTS_TEXT_LENGTH = 5000;

export const ttsSynthesisRequestSchema = z.object({
  provider: z.enum(TTS_PROVIDER_IDS),
  text: z.string().trim().min(1, "Le texte est vide.").max(MAX_TTS_TEXT_LENGTH, `Le texte dépasse ${MAX_TTS_TEXT_LENGTH} caractères.`),
  voiceId: z.string().min(1, "Aucune voix sélectionnée."),
  settings: z.record(z.string(), z.unknown()),
});

export type TtsSynthesisRequestBody = z.infer<typeof ttsSynthesisRequestSchema>;

function textExcerpt(text: string): string {
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
}

export async function runTtsSynthesis(
  request: TtsSynthesisRequestBody,
  signal?: AbortSignal
): Promise<{ entry: TtsHistoryEntry; audio: Buffer }> {
  const providerId: TtsProviderId = request.provider;
  const provider = getTtsProvider(providerId);
  const providerLogger = createLogger(providerId);

  let settings;
  try {
    settings = provider.settingsSchema.parse(request.settings);
  } catch (err) {
    throw toAppError(err, providerId);
  }

  providerLogger.info("synthesis.start", `Synthèse demandée (voix ${request.voiceId}).`, {
    meta: { voiceId: request.voiceId, textLength: request.text.length, textExcerpt: textExcerpt(request.text), settings },
  });

  const startedAt = performance.now();
  let output;
  try {
    // NOTE: le cast est sûr, `settings` a été validé par le schéma du provider ciblé.
    output = await provider.synthesize({ text: request.text, voiceId: request.voiceId, settings: settings as never, signal });
  } catch (err) {
    const appError = toAppError(err, providerId);
    providerLogger.error("synthesis.failed", appError.message, {
      durationMs: Math.round(performance.now() - startedAt),
      meta: { code: appError.code, hint: appError.hint, details: appError.details },
      error: appError.cause ?? appError,
    });
    throw appError;
  }

  const generationTimeMs = Math.round(performance.now() - startedAt);
  const entry = saveTtsAudio(output.audio, {
    text: request.text,
    provider: providerId,
    voiceId: request.voiceId,
    voiceName: output.voiceName,
    format: output.format,
    generationTimeMs,
    settings: { ...settings },
    runtime: output.runtime,
    fallback: output.fallback,
  });

  providerLogger.info("synthesis.done", `Audio ${output.format.toUpperCase()} généré (${(output.audio.length / 1024).toFixed(1)} Ko).`, {
    durationMs: generationTimeMs,
    meta: { fileName: entry.fileName, sizeBytes: output.audio.length, runtime: output.runtime, fallback: output.fallback, ...output.diagnostics },
  });
  return { entry, audio: output.audio };
}
