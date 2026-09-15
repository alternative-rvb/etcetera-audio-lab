const AI_SERVICE_URL = process.env.AI_SERVICE_URL || process.env.CHATTERBOX_URL || "http://127.0.0.1:5002";

export interface STTTranscriptionOptions {
  modelSize?: "tiny" | "base" | "small" | "medium";
  language?: string;
  device?: "cuda" | "cpu";
  beamSize?: number;
  wordTimestamps?: boolean;
}

export interface STTWord {
  word: string;
  start: number;
  end: number;
  probability: number;
}

export interface STTSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  avg_logprob?: number;
  no_speech_prob?: number;
  words?: STTWord[];
}

export interface STTTranscriptionResult {
  text: string;
  language: string;
  languageProbability: number;
  duration: number;
  processingTimeMs: number;
  rtf: number;
  modelSize: string;
  device: string;
  segments: STTSegment[];
}

export async function transcribeAudioWhisper(
  audioBuffer: Buffer,
  filename: string = "audio.wav",
  options: STTTranscriptionOptions = {}
): Promise<STTTranscriptionResult> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/wav" });
  formData.append("file", blob, filename);
  formData.append("model_size", options.modelSize || "base");
  formData.append("language", options.language || "fr");
  formData.append("device", options.device || "cpu");
  formData.append("beam_size", String(options.beamSize || 5));
  formData.append("word_timestamps", String(options.wordTimestamps ?? true));

  let res: Response;
  try {
    res = await fetch(`${AI_SERVICE_URL}/stt/transcribe`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(300000),
    });
  } catch (err: any) {
    if (err?.cause?.code === "ECONNREFUSED" || err?.message?.includes("fetch failed")) {
      throw new Error(
        "Le micro-service Python Whisper n'est pas accessible sur le port 5002."
      );
    }
    throw err;
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Erreur Whisper STT (${res.status}): ${errText || res.statusText}`);
  }

  const data = (await res.json()) as any;
  return {
    text: data.text || "",
    language: data.language || "fr",
    languageProbability: data.language_probability ?? 1.0,
    duration: data.duration ?? 0,
    processingTimeMs: data.processing_time_ms ?? 0,
    rtf: data.rtf ?? 0,
    modelSize: data.model_size || options.modelSize || "base",
    device: data.device || options.device || "cuda",
    segments: data.segments || [],
  };
}
