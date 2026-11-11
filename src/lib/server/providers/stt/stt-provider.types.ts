import "server-only";
import type { GroqWhisperModel, ProviderHealth, SttProviderId, SttTranscriptionResult, WhisperModelSize } from "@/lib/shared/types";

// SECTION: Contrat commun des providers STT exécutés côté serveur (whisper, sherpa, groq).
// Web Speech tourne dans le navigateur : le serveur ne fait qu'enregistrer son résultat.

export interface SttTranscriptionInput {
  audio: Buffer;
  fileName: string;
  mimeType: string;
  language: string;
  modelSize: WhisperModelSize;
  device: "cpu" | "cuda";
  wordTimestamps: boolean;
  groqModel: GroqWhisperModel;
  signal?: AbortSignal;
}

export interface ServerSttProvider {
  id: Exclude<SttProviderId, "web-speech">;
  transcribe(input: SttTranscriptionInput): Promise<SttTranscriptionResult>;
  checkHealth(): Promise<ProviderHealth>;
}
