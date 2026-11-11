import "server-only";
import type { z } from "zod";
import type { AudioFormat, ProviderHealth, RuntimeTrace, TtsProviderId, TtsSettingsByProvider, TtsVoiceList } from "@/lib/shared/types";

// SECTION: Contrat commun que chaque provider TTS implémente (edge-tts, piper, kokoro, chatterbox).

export interface TtsSynthesisInput<P extends TtsProviderId> {
  text: string;
  voiceId: string;
  settings: TtsSettingsByProvider[P];
  signal?: AbortSignal;
}

export interface TtsSynthesisOutput extends RuntimeTrace {
  audio: Buffer;
  format: AudioFormat;
  voiceName: string;
  /** Informations propres au moteur, ajoutées aux logs (modèle chargé, device, etc.). */
  diagnostics?: Record<string, unknown>;
}

export interface TtsProvider<P extends TtsProviderId = TtsProviderId> {
  id: P;
  settingsSchema: z.ZodType<TtsSettingsByProvider[P]>;
  listVoices(locale?: string): Promise<TtsVoiceList>;
  synthesize(input: TtsSynthesisInput<P>): Promise<TtsSynthesisOutput>;
  checkHealth(): Promise<ProviderHealth>;
}
