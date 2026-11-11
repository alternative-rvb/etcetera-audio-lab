import "server-only";
import type { OfflineRecognizer, OfflineRecognizerConfig } from "sherpa-onnx-node";
import type { SttSegment, SttTranscriptionResult } from "@/lib/shared/types";
import { decodeAudioToPcm16k, STT_SAMPLE_RATE } from "@/lib/server/core/audio-decode";
import { AppError } from "@/lib/server/core/errors";
import { createInstanceCache, loadSherpa, sherpaModelPath } from "@/lib/server/core/sherpa-runtime";
import type { ServerSttProvider } from "./stt-provider.types";

// SECTION: Transcription hors ligne avec sherpa-onnx-node, commune à Whisper (CPU) et Sherpa (Parakeet).
// La VAD Silero découpe l'audio en segments de parole, chacun transcrit séparément : on obtient des segments horodatés.

const recognizerCache = createInstanceCache<OfflineRecognizer>();
const VAD_WINDOW_SIZE = 512;

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const err = new Error("Transcription annulée.");
    err.name = "AbortError";
    throw err;
  }
}

export async function transcribeWithSherpa(options: {
  provider: ServerSttProvider["id"];
  audio: Buffer;
  /** Clé de cache de la configuration du modèle (une instance par modèle et par langue). */
  recognizerKey: string;
  recognizerConfig: () => OfflineRecognizerConfig;
  /** Durée maximale d'un segment : Whisper ne traite pas plus de 30 s d'un coup. */
  maxSegmentSec: number;
  language: string;
  modelSize: string;
  signal?: AbortSignal;
}): Promise<SttTranscriptionResult> {
  const { provider, signal } = options;
  const sherpa = await loadSherpa(provider);
  const vadModel = sherpaModelPath(provider, "silero_vad.onnx");
  const config = options.recognizerConfig();
  const recognizer = await recognizerCache.get(options.recognizerKey, () => sherpa.OfflineRecognizer.createAsync(config));

  const startedAt = performance.now();
  const samples = await decodeAudioToPcm16k(options.audio, { provider, signal });
  const durationSec = samples.length / STT_SAMPLE_RATE;

  const vad = new sherpa.Vad(
    {
      sileroVad: { model: vadModel, threshold: 0.5, minSilenceDuration: 0.4, minSpeechDuration: 0.25, maxSpeechDuration: options.maxSegmentSec, windowSize: VAD_WINDOW_SIZE },
      sampleRate: STT_SAMPLE_RATE,
      numThreads: 1,
      debug: false,
    },
    Math.ceil(durationSec) + 10
  );

  const speech: Array<{ start: number; samples: Float32Array }> = [];
  const drain = () => {
    while (!vad.isEmpty()) {
      const segment = vad.front(false);
      speech.push({ start: segment.start, samples: segment.samples });
      vad.pop();
    }
  };
  for (let i = 0; i < samples.length; i += VAD_WINDOW_SIZE) {
    vad.acceptWaveform(samples.subarray(i, i + VAD_WINDOW_SIZE));
    drain();
  }
  vad.flush();
  drain();

  const segments: SttSegment[] = [];
  let lang: string | undefined;
  try {
    for (const part of speech) {
      throwIfAborted(signal);
      const stream = recognizer.createStream();
      stream.acceptWaveform({ sampleRate: STT_SAMPLE_RATE, samples: part.samples });
      await recognizer.decodeAsync(stream);
      const result = recognizer.getResult(stream);
      const text = result.text.trim();
      if (result.lang) lang = result.lang.replace(/[<>|]/g, "");
      if (!text) continue;
      const start = part.start / STT_SAMPLE_RATE;
      segments.push({ id: segments.length, start: round2(start), end: round2(start + part.samples.length / STT_SAMPLE_RATE), text });
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    throw new AppError("ENGINE_FAILED", "La transcription sherpa-onnx a échoué.", { provider, cause: err });
  }

  const processingTimeMs = Math.round(performance.now() - startedAt);
  return {
    text: segments.map((segment) => segment.text).join(" "),
    language: lang || options.language,
    durationSec: round2(durationSec),
    processingTimeMs,
    rtf: durationSec > 0 ? Math.round((processingTimeMs / 1000 / durationSec) * 1000) / 1000 : 0,
    modelSize: options.modelSize,
    device: "cpu",
    segments,
    runtime: "node",
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
