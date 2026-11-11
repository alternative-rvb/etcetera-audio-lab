// SECTION: Types partagés entre le serveur (routes API) et le client (UI React).
// ANCHOR: ce fichier ne doit importer aucun module Node, il est inclus dans le bundle navigateur.

export const TTS_PROVIDER_IDS = ["edge-tts", "piper", "kokoro", "chatterbox"] as const;
export type TtsProviderId = (typeof TTS_PROVIDER_IDS)[number];

export const STT_PROVIDER_IDS = ["web-speech", "whisper", "sherpa", "groq"] as const;
export type SttProviderId = (typeof STT_PROVIDER_IDS)[number];

export const LOG_SOURCES = [
  ...TTS_PROVIDER_IDS,
  ...STT_PROVIDER_IDS,
  "api",
  "python-service",
  "system",
  "browser",
] as const;
export type LogSource = (typeof LOG_SOURCES)[number];

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export type LogOrigin = "node" | "python" | "browser";

export interface SerializedError {
  name: string;
  message: string;
  code?: string;
  stack?: string;
  cause?: SerializedError;
}

export interface LogEntry {
  id: string;
  seq: number;
  ts: string;
  level: LogLevel;
  source: LogSource;
  origin: LogOrigin;
  event: string;
  message: string;
  requestId?: string;
  durationMs?: number;
  meta?: Record<string, unknown>;
  error?: SerializedError;
}

// SECTION: Erreurs API

export const API_ERROR_CODES = [
  "VALIDATION",
  "VOICE_NOT_FOUND",
  "ENGINE_UNAVAILABLE",
  "PYTHON_SERVICE_DOWN",
  "TIMEOUT",
  "ENGINE_FAILED",
  "NOT_FOUND",
  "INTERNAL",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    hint?: string;
    provider?: TtsProviderId | SttProviderId;
    requestId: string;
    details?: unknown;
  };
}

// SECTION: Santé des providers

export type ProviderHealthStatus = "ok" | "degraded" | "down";

// SECTION: Exécution d'un moteur

/** Où le moteur a réellement tourné : dans Node (sherpa-onnx), dans le service Python ou via le binaire Piper. */
export type EngineRuntime = "node" | "python" | "binary";

export interface RuntimeTrace {
  runtime?: EngineRuntime;
  /** Vrai quand l'exécution principale (Node) a échoué et que le secours a pris le relais. */
  fallback?: boolean;
}

export interface ProviderHealth {
  status: ProviderHealthStatus;
  reason?: string;
  hint?: string;
  details?: Record<string, unknown>;
}

export interface HealthReport {
  checkedAt: string;
  tts: Record<TtsProviderId, ProviderHealth>;
  stt: Record<SttProviderId, ProviderHealth>;
  pythonService: ProviderHealth;
}

// SECTION: Voix TTS

export type VoiceGender = "female" | "male" | "unknown";

export interface TtsVoice {
  id: string;
  name: string;
  language: string;
  gender: VoiceGender;
  quality: string;
}

export interface TtsVoiceList {
  provider: TtsProviderId;
  voices: TtsVoice[];
  /** Vrai quand la liste vient d'un repli (service injoignable). */
  degraded?: boolean;
  degradedReason?: string;
}

// SECTION: Réglages par provider TTS

export interface EdgeTtsSettings {
  ratePercent: number;
}
export interface PiperSettings {
  lengthScale: number;
  noiseScale: number;
  noiseW: number;
}
export interface KokoroSettings {
  speed: number;
}
export interface ChatterboxSettings {
  device: "cpu" | "cuda";
  exaggeration: number;
  temperature: number;
}

export interface TtsSettingsByProvider {
  "edge-tts": EdgeTtsSettings;
  piper: PiperSettings;
  kokoro: KokoroSettings;
  chatterbox: ChatterboxSettings;
}

export type TtsSynthesisRequest = {
  [P in TtsProviderId]: { provider: P; text: string; voiceId: string; settings: TtsSettingsByProvider[P] };
}[TtsProviderId];

// SECTION: Historique TTS

export type AudioFormat = "wav" | "mp3";

export interface TtsHistoryEntry extends RuntimeTrace {
  id: string;
  createdAt: string;
  text: string;
  provider: TtsProviderId;
  voiceId: string;
  voiceName: string;
  fileName: string;
  /** Chemin absolu sur le disque, affiché pour copie. */
  filePath: string;
  url: string;
  format: AudioFormat;
  sizeBytes: number;
  isFavorite: boolean;
  /** Note sur 3 (0 = non noté). */
  score: number;
  generationTimeMs: number;
  settings?: Record<string, unknown>;
}

// SECTION: STT

export interface SttWord {
  word: string;
  start: number;
  end: number;
  /** Absente quand le moteur ne la fournit pas (Groq). */
  probability?: number;
}

export interface SttSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  avg_logprob?: number;
  no_speech_prob?: number;
  words?: SttWord[];
}

export type WhisperModelSize = "tiny" | "base" | "small" | "medium";

export const GROQ_WHISPER_MODELS = ["whisper-large-v3-turbo", "whisper-large-v3"] as const;
export type GroqWhisperModel = (typeof GROQ_WHISPER_MODELS)[number];

export interface SttTranscriptionResult extends RuntimeTrace {
  text: string;
  language: string;
  languageProbability?: number;
  durationSec: number;
  processingTimeMs: number;
  rtf: number;
  modelSize: string;
  device: string;
  segments: SttSegment[];
}

export interface SttHistoryEntry extends SttTranscriptionResult {
  id: string;
  createdAt: string;
  provider: SttProviderId;
  fileName?: string;
  filePath?: string;
  url?: string;
  originalFilename?: string;
  isFavorite: boolean;
  score: number;
}

export interface SttTranscribeResponse {
  entry: SttHistoryEntry;
}
