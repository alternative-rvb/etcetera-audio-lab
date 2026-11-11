import "server-only";
import type { SttSegment, SttTranscriptionResult } from "@/lib/shared/types";
import { callPythonService } from "@/lib/server/core/python-service-client";
import { fetchPythonServiceHealth } from "@/lib/server/core/python-service-health";
import { combineHealth, runWithFallback } from "@/lib/server/core/runtime-fallback";
import { hasSherpaModel, loadSherpa, SHERPA_NUM_THREADS, SHERPA_SETUP_HINT, sherpaModelPath } from "@/lib/server/core/sherpa-runtime";
import type { ProviderHealth } from "@/lib/shared/types";
import type { ServerSttProvider, SttTranscriptionInput } from "../stt-provider.types";
import { transcribeWithSherpa } from "../sherpa-asr";

// SECTION: Provider Whisper.
// Sur CPU : exécution en Node (sherpa-onnx-node, modèles int8 de models/sherpa/), secours par Faster-Whisper du service Python.
// Sur CUDA : directement Faster-Whisper du service Python (python/stt/whisper.py), seul à exploiter la carte graphique.

const WHISPER_TIMEOUT_MS = 5 * 60_000;

interface PythonWhisperResponse {
  text?: string;
  language?: string;
  language_probability?: number;
  duration?: number;
  processing_time_ms?: number;
  rtf?: number;
  model_size?: string;
  device?: string;
  segments?: SttSegment[];
}

export async function transcribeWithFasterWhisper(
  input: SttTranscriptionInput,
  provider: ServerSttProvider["id"]
): Promise<SttTranscriptionResult> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(input.audio)], { type: input.mimeType || "audio/wav" }), input.fileName);
  form.append("model_size", input.modelSize);
  form.append("language", input.language);
  form.append("device", input.device);
  form.append("beam_size", "5");
  form.append("word_timestamps", String(input.wordTimestamps));

  const response = await callPythonService("/stt/transcribe", {
    provider,
    method: "POST",
    body: form,
    timeoutMs: WHISPER_TIMEOUT_MS,
    signal: input.signal,
  });
  const data = (await response.json()) as PythonWhisperResponse;
  return {
    text: data.text ?? "",
    language: data.language ?? input.language,
    languageProbability: data.language_probability,
    durationSec: data.duration ?? 0,
    processingTimeMs: data.processing_time_ms ?? 0,
    rtf: data.rtf ?? 0,
    modelSize: data.model_size ?? input.modelSize,
    device: data.device ?? input.device,
    segments: data.segments ?? [],
    runtime: "python",
  };
}

/** Whisper en Node : même modèle OpenAI, export ONNX int8 de sherpa-onnx, sans horodatage mot à mot. */
export function transcribeWhisperWithSherpa(input: SttTranscriptionInput, provider: ServerSttProvider["id"]) {
  const size = input.modelSize;
  const dir = `sherpa-onnx-whisper-${size}`;
  const language = input.language === "auto" ? "" : input.language;
  return transcribeWithSherpa({
    provider,
    audio: input.audio,
    recognizerKey: `whisper-${size}-${language || "auto"}`,
    recognizerConfig: () => ({
      featConfig: { sampleRate: 16000, featureDim: 80 },
      modelConfig: {
        whisper: {
          encoder: sherpaModelPath(provider, dir, `${size}-encoder.int8.onnx`),
          decoder: sherpaModelPath(provider, dir, `${size}-decoder.int8.onnx`),
          language,
          task: "transcribe",
        },
        tokens: sherpaModelPath(provider, dir, `${size}-tokens.txt`),
        numThreads: SHERPA_NUM_THREADS,
        provider: "cpu",
        debug: false,
      },
    }),
    maxSegmentSec: 25,
    language: input.language,
    modelSize: size,
    signal: input.signal,
  });
}

async function whisperNodeHealth(): Promise<ProviderHealth> {
  try {
    await loadSherpa("whisper");
  } catch {
    return { status: "down", reason: "sherpa-onnx-node indisponible.", hint: "Lancez `npm install`." };
  }
  const sizes = (["tiny", "base", "small", "medium"] as const).filter((size) => hasSherpaModel(`sherpa-onnx-whisper-${size}`));
  if (sizes.length === 0 || !hasSherpaModel("silero_vad.onnx")) {
    return { status: "down", reason: "Modèles Whisper absents de models/sherpa/.", hint: SHERPA_SETUP_HINT };
  }
  return { status: "ok", details: { runtime: "node", nodeModels: sizes } };
}

export const whisperProvider: ServerSttProvider = {
  id: "whisper",
  async transcribe(input) {
    if (input.device === "cuda") return transcribeWithFasterWhisper(input, "whisper");
    const { result, fallback } = await runWithFallback({
      provider: "whisper",
      primaryLabel: "Whisper en Node",
      fallbackLabel: "service Python",
      signal: input.signal,
      primary: () => transcribeWhisperWithSherpa(input, "whisper"),
      fallback: () => transcribeWithFasterWhisper(input, "whisper"),
    });
    return { ...result, fallback };
  },
  async checkHealth() {
    const [node, python] = await Promise.all([whisperNodeHealth(), fetchPythonServiceHealth()]);
    const pythonHealth: ProviderHealth =
      python.status === "ok"
        ? { status: "ok", details: { loadedModels: python.details?.loaded_whisper_models ?? [], cudaAvailable: python.details?.cuda_available ?? false } }
        : python;
    const combined = combineHealth(node, pythonHealth, "service Python");
    // NOTE: la santé globale reflète le CPU (Node) ; CUDA dépend du service Python, signalé dans les détails.
    return { ...combined, details: { ...combined.details, cudaAvailable: python.details?.cuda_available ?? false, python: python.status } };
  },
};
