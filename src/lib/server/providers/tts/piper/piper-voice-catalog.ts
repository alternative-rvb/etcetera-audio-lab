import "server-only";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { TtsVoice, VoiceGender } from "@/lib/shared/types";
import { PROJECT_PATHS } from "@/lib/server/core/paths";
import { createLogger } from "@/lib/server/core/logger";
import { filterVoicesByLocale } from "../tts-voice-utils";

// SECTION: Catalogue des voix Piper, construit en scannant voices/*.onnx.json.

const piperLogger = createLogger("piper");

export interface PiperVoice extends TtsVoice {
  onnxPath: string;
  sampleRate: number;
}

const PIPER_VOICE_DISPLAY_NAMES: Record<string, { name: string; gender: VoiceGender }> = {
  "fr_FR-siwis-medium": { name: "Siwis", gender: "female" },
  "fr_FR-upmc-medium": { name: "UPMC", gender: "female" },
  "fr_FR-tom-medium": { name: "Tom", gender: "male" },
  "fr_FR-gilles-low": { name: "Gilles", gender: "male" },
  "en_US-lessac-medium": { name: "Lessac", gender: "female" },
};

export function listPiperVoices(locale?: string): PiperVoice[] {
  const dir = PROJECT_PATHS.piperVoicesDir;
  if (!existsSync(dir)) return [];

  const voices: PiperVoice[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".onnx.json"))) {
    const id = file.replace(/\.onnx\.json$/, "");
    try {
      const config = JSON.parse(readFileSync(join(dir, file), "utf-8"));
      const known = PIPER_VOICE_DISPLAY_NAMES[id];
      voices.push({
        id,
        name: known?.name ?? config.dataset ?? id,
        language: (config.language?.code ?? config.language?.family ?? "unknown").replace("_", "-"),
        gender: known?.gender ?? "unknown",
        quality: config.audio?.quality ?? "medium",
        onnxPath: join(dir, `${id}.onnx`),
        sampleRate: config.audio?.sample_rate ?? 22050,
      });
    } catch (err) {
      piperLogger.warn("voices.invalid_config", `Configuration de voix illisible : ${file}`, { error: err });
    }
  }
  return filterVoicesByLocale(voices, locale);
}

export function findPiperVoice(voiceId: string): PiperVoice | undefined {
  return listPiperVoices().find((voice) => voice.id === voiceId);
}
