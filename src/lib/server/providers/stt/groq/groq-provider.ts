import "server-only";
import { AppError } from "@/lib/server/core/errors";
import { GROQ_API_BASE, GROQ_KEY_HINT, readGroqApiKey, readGroqError } from "@/lib/server/core/groq-api";
import type { ProviderHealth, SttSegment, SttTranscriptionResult, SttWord } from "@/lib/shared/types";
import type { ServerSttProvider, SttTranscriptionInput } from "../stt-provider.types";

// SECTION: Provider Groq Whisper (API cloud compatible OpenAI).
// LINK: https://console.groq.com/docs/speech-to-text
// NOTE: la clé GROQ_API_KEY est lue dans .env.local (chargé par Next), jamais exposée au navigateur.

const GROQ_TRANSCRIPTIONS_URL = `${GROQ_API_BASE}/audio/transcriptions`;
const GROQ_TIMEOUT_MS = 2 * 60_000;
/** Limite de l'offre gratuite ; au-delà, Groq exige le paramètre `url` (fichier hébergé). */
const GROQ_MAX_FILE_BYTES = 25 * 1024 * 1024;

interface GroqVerboseResponse {
  text?: string;
  language?: string;
  duration?: number;
  segments?: Array<{ id: number; start: number; end: number; text: string; avg_logprob?: number; no_speech_prob?: number }>;
  words?: Array<{ word: string; start: number; end: number }>;
}

/** Groq renvoie le nom anglais de la langue détectée ("french") : on revient au code ISO quand il est connu. */
const LANGUAGE_NAME_TO_CODE: Record<string, string> = { french: "fr", english: "en", spanish: "es", german: "de", italian: "it" };

/** Les mots arrivent à plat : on les range dans le segment qui contient leur début. */
function attachWords(segments: SttSegment[], words: GroqVerboseResponse["words"]): SttSegment[] {
  if (!words?.length) return segments;
  return segments.map((segment, index) => {
    const isLast = index === segments.length - 1;
    const segmentWords: SttWord[] = words
      .filter((w) => w.start >= segment.start && (isLast ? true : w.start < segment.end))
      .map((w) => ({ word: ` ${w.word.trim()}`, start: w.start, end: w.end }));
    return segmentWords.length ? { ...segment, words: segmentWords } : segment;
  });
}

async function transcribeWithGroq(input: SttTranscriptionInput): Promise<SttTranscriptionResult> {
  const apiKey = readGroqApiKey();
  if (!apiKey) {
    throw new AppError("ENGINE_UNAVAILABLE", "Clé API Groq absente.", { provider: "groq", hint: GROQ_KEY_HINT });
  }
  if (input.audio.length > GROQ_MAX_FILE_BYTES) {
    throw new AppError("VALIDATION", `Fichier trop volumineux pour Groq (${(input.audio.length / 1024 / 1024).toFixed(1)} Mo, maximum 25 Mo).`, {
      provider: "groq",
      hint: "Compressez l'audio (MP3, Opus) ou découpez-le.",
    });
  }

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(input.audio)], { type: input.mimeType || "audio/wav" }), input.fileName);
  form.append("model", input.groqModel);
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");
  if (input.language !== "auto") form.append("language", input.language);
  form.append("timestamp_granularities[]", "segment");
  if (input.wordTimestamps) form.append("timestamp_granularities[]", "word");

  const signal = input.signal ? AbortSignal.any([input.signal, AbortSignal.timeout(GROQ_TIMEOUT_MS)]) : AbortSignal.timeout(GROQ_TIMEOUT_MS);
  const startedAt = performance.now();
  const response = await fetch(GROQ_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal,
  });

  if (!response.ok) {
    const message = await readGroqError(response);
    if (response.status === 401) {
      throw new AppError("ENGINE_UNAVAILABLE", `Clé API Groq refusée : ${message}`, { provider: "groq", hint: GROQ_KEY_HINT });
    }
    if (response.status === 429) {
      throw new AppError("ENGINE_FAILED", `Quota Groq atteint : ${message}`, {
        provider: "groq",
        status: 429,
        hint: "Offre gratuite : 20 requêtes par minute, 2 000 par jour, 8 h d'audio par jour. Patientez puis réessayez.",
      });
    }
    throw new AppError("ENGINE_FAILED", `Groq a refusé la transcription : ${message}`, { provider: "groq", details: { status: response.status } });
  }

  const data = (await response.json()) as GroqVerboseResponse;
  const processingTimeMs = Math.round(performance.now() - startedAt);
  const durationSec = data.duration ?? 0;
  const segments: SttSegment[] = (data.segments ?? []).map((s) => ({
    id: s.id,
    start: s.start,
    end: s.end,
    text: s.text,
    avg_logprob: s.avg_logprob,
    no_speech_prob: s.no_speech_prob,
  }));
  const detected = data.language?.toLowerCase();

  return {
    text: (data.text ?? "").trim(),
    language: input.language !== "auto" ? input.language : (detected && LANGUAGE_NAME_TO_CODE[detected]) || detected || "auto",
    durationSec,
    // NOTE: temps aller-retour réseau compris, c'est ce que verrait NowWeAct.
    processingTimeMs,
    rtf: durationSec > 0 ? Number((processingTimeMs / 1000 / durationSec).toFixed(3)) : 0,
    modelSize: input.groqModel,
    device: "cloud Groq",
    segments: input.wordTimestamps ? attachWords(segments, data.words) : segments,
  };
}

export const groqProvider: ServerSttProvider = {
  id: "groq",
  transcribe: transcribeWithGroq,
  async checkHealth(): Promise<ProviderHealth> {
    // NOTE: pas d'appel réseau, pour ne pas consommer le quota à chaque vérification.
    if (!readGroqApiKey()) return { status: "down", reason: "Clé GROQ_API_KEY absente.", hint: GROQ_KEY_HINT };
    return { status: "ok", details: { network: "requis, non vérifié" } };
  },
};
