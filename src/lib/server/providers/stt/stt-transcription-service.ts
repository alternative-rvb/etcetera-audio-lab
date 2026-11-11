import "server-only";
import { z } from "zod";
import { GROQ_WHISPER_MODELS, STT_PROVIDER_IDS, type SttHistoryEntry, type SttProviderId } from "@/lib/shared/types";
import { AppError, toAppError } from "@/lib/server/core/errors";
import { createLogger } from "@/lib/server/core/logger";
import { saveSttTranscription } from "@/lib/server/history/stt-history-repository";
import { SERVER_STT_PROVIDERS } from "./stt-provider-registry";

// SECTION: Orchestration d'une transcription STT (multipart/form-data), commune aux providers.

export const MAX_STT_FILE_BYTES = 50 * 1024 * 1024;

const formFieldsSchema = z.object({
  provider: z.enum(STT_PROVIDER_IDS),
  language: z.string().min(2).max(10).default("fr"),
  modelSize: z.enum(["tiny", "base", "small", "medium"]).default("base"),
  device: z.enum(["cpu", "cuda"]).default("cpu"),
  wordTimestamps: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  groqModel: z.enum(GROQ_WHISPER_MODELS).default("whisper-large-v3-turbo"),
  // NOTE: champs propres à Web Speech (transcription faite dans le navigateur).
  browserTranscript: z.string().max(20_000).optional(),
  browserDurationSec: z.coerce.number().min(0).optional(),
});

function readFormFields(form: FormData) {
  const raw: Record<string, string> = {};
  for (const [key, value] of form.entries()) if (typeof value === "string") raw[key] = value;
  return formFieldsSchema.parse(raw);
}

export async function runSttTranscription(request: Request): Promise<SttHistoryEntry> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch (err) {
    throw new AppError("VALIDATION", "Requête multipart illisible.", { cause: err });
  }
  const fields = readFormFields(form);
  const providerId: SttProviderId = fields.provider;
  const providerLogger = createLogger(providerId);

  const file = form.get("file");
  const audioFile = file instanceof File && file.size > 0 ? file : null;
  if (audioFile && audioFile.size > MAX_STT_FILE_BYTES) {
    throw new AppError("VALIDATION", `Fichier trop volumineux (${(audioFile.size / 1024 / 1024).toFixed(1)} Mo, maximum 50 Mo).`, {
      provider: providerId,
    });
  }
  const audio = audioFile ? Buffer.from(await audioFile.arrayBuffer()) : null;

  // SECTION: Web Speech, résultat déjà calculé par le navigateur
  if (providerId === "web-speech") {
    const transcript = fields.browserTranscript?.trim();
    if (!transcript) {
      throw new AppError("VALIDATION", "Aucune transcription Web Speech reçue.", {
        provider: "web-speech",
        hint: "Web Speech ne fonctionne qu'en direct au micro : parlez pendant l'enregistrement.",
      });
    }
    const durationSec = fields.browserDurationSec ?? 0;
    const entry = saveSttTranscription(audio, {
      provider: "web-speech",
      originalFilename: audioFile?.name,
      result: {
        text: transcript,
        language: fields.language,
        durationSec,
        processingTimeMs: 0,
        rtf: 0,
        modelSize: "navigateur",
        device: "navigateur",
        segments: [],
      },
    });
    providerLogger.info("transcription.saved", `Transcription navigateur enregistrée (${transcript.length} caractères).`, {
      meta: { durationSec, language: fields.language },
    });
    return entry;
  }

  // SECTION: Providers serveur (Whisper, Sherpa, Groq)
  if (!audio || !audioFile) {
    throw new AppError("VALIDATION", "Fichier audio manquant.", { provider: providerId });
  }
  const provider = SERVER_STT_PROVIDERS[providerId];
  providerLogger.info("transcription.start", `Transcription de ${audioFile.name} (${(audio.length / 1024).toFixed(0)} Ko).`, {
    meta: { modelSize: fields.modelSize, device: fields.device, language: fields.language, mimeType: audioFile.type },
  });

  const startedAt = performance.now();
  try {
    const result = await provider.transcribe({
      audio,
      fileName: audioFile.name || "audio.wav",
      mimeType: audioFile.type,
      language: fields.language,
      modelSize: fields.modelSize,
      device: fields.device,
      wordTimestamps: fields.wordTimestamps,
      groqModel: fields.groqModel,
      signal: request.signal,
    });
    const entry = saveSttTranscription(audio, { provider: providerId, originalFilename: audioFile.name, result });
    providerLogger.info("transcription.done", `${result.segments.length} segment(s), RTF ${result.rtf}.`, {
      durationMs: Math.round(performance.now() - startedAt),
      meta: {
          audioDurationSec: result.durationSec,
          rtf: result.rtf,
          modelSize: result.modelSize,
          device: result.device,
          runtime: result.runtime,
          fallback: result.fallback,
        },
    });
    return entry;
  } catch (err) {
    const appError = toAppError(err, providerId);
    providerLogger.error("transcription.failed", appError.message, {
      durationMs: Math.round(performance.now() - startedAt),
      meta: { code: appError.code, hint: appError.hint, details: appError.details },
      error: appError.cause ?? appError,
    });
    throw appError;
  }
}
