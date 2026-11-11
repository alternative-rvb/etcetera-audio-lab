import "server-only";
import type { SttSegment, SttTranscriptionResult } from "@/lib/shared/types";
import { callPythonService } from "@/lib/server/core/python-service-client";
import { fetchPythonServiceHealth } from "@/lib/server/core/python-service-health";
import type { ServerSttProvider, SttTranscriptionInput } from "../stt-provider.types";

// SECTION: Provider Whisper (Faster-Whisper, exécuté par le service Python python/stt/whisper.py).

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
  };
}

export const whisperProvider: ServerSttProvider = {
  id: "whisper",
  transcribe: (input) => transcribeWithFasterWhisper(input, "whisper"),
  async checkHealth() {
    const python = await fetchPythonServiceHealth();
    if (python.status !== "ok") return python;
    return {
      status: "ok",
      details: {
        loadedModels: python.details?.loaded_whisper_models ?? [],
        cudaAvailable: python.details?.cuda_available ?? false,
      },
    };
  },
};
