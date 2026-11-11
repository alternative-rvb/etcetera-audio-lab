import type { SttProviderId, WhisperModelSize } from "@/lib/shared/types";

// SECTION: Réglages STT par provider (côté navigateur, envoyés dans le formulaire de transcription).

export type WhisperLanguage = "fr" | "en" | "auto";
export type WebSpeechLanguage = "fr-FR" | "en-US" | "es-ES";

export interface WhisperSettings {
  modelSize: WhisperModelSize;
  device: "cpu" | "cuda";
  language: WhisperLanguage;
  wordTimestamps: boolean;
}

export interface SherpaSettings {
  modelSize: Extract<WhisperModelSize, "tiny" | "base">;
  language: WhisperLanguage;
}

export interface WebSpeechSettings {
  language: WebSpeechLanguage;
}

export interface SttSettingsByProvider {
  whisper: WhisperSettings;
  sherpa: SherpaSettings;
  "web-speech": WebSpeechSettings;
}

export const DEFAULT_STT_SETTINGS: SttSettingsByProvider = {
  whisper: { modelSize: "base", device: "cpu", language: "fr", wordTimestamps: true },
  sherpa: { modelSize: "tiny", language: "fr" },
  "web-speech": { language: "fr-FR" },
};

export const WHISPER_LANGUAGE_OPTIONS: Array<{ value: WhisperLanguage; label: string }> = [
  { value: "fr", label: "Français" },
  { value: "en", label: "Anglais" },
  { value: "auto", label: "Automatique" },
];

/** Champs du formulaire multipart attendus par POST /api/stt/transcribe. */
export function buildSttFormFields(provider: SttProviderId, settings: SttSettingsByProvider): Record<string, string> {
  switch (provider) {
    case "whisper": {
      const s = settings.whisper;
      return { provider, modelSize: s.modelSize, device: s.device, language: s.language, wordTimestamps: String(s.wordTimestamps) };
    }
    case "sherpa": {
      const s = settings.sherpa;
      return { provider, modelSize: s.modelSize, device: "cpu", language: s.language, wordTimestamps: "false" };
    }
    case "web-speech":
      return { provider, language: settings["web-speech"].language.slice(0, 2) };
  }
}
