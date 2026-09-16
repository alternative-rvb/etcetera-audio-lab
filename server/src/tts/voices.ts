import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface VoiceInfo {
  id: string;
  name: string;
  language: string;
  gender: "female" | "male" | "unknown";
  quality: string;
  onnxPath: string;
  sampleRate: number;
}

const VOICES_DIR = join(import.meta.dirname, "..", "..", "voices");

const PIPER_VOICE_META: Record<string, { name: string; gender: "female" | "male" }> = {
  "fr_FR-siwis-medium": { name: "Siwis", gender: "female" },
  "fr_FR-upmc-medium": { name: "UPMC", gender: "female" },
  "fr_FR-tom-medium": { name: "Tom", gender: "male" },
  "fr_FR-gilles-low": { name: "Gilles", gender: "male" },
  "en_US-lessac-medium": { name: "Lessac", gender: "female" },
};

export function listVoices(locale?: string): VoiceInfo[] {
  const files = readdirSync(VOICES_DIR).filter((f) => f.endsWith(".onnx.json"));

  const voices = files.map((file) => {
    const id = file.replace(/\.onnx\.json$/, "");
    const config = JSON.parse(readFileSync(join(VOICES_DIR, file), "utf-8"));
    const language = config.language?.code ?? config.language?.family ?? "unknown";
    const sampleRate = config.audio?.sample_rate ?? 22050;
    const quality = config.audio?.quality ?? "medium";
    const meta = PIPER_VOICE_META[id];

    return {
      id,
      name: meta?.name ?? config.dataset ?? id,
      language,
      gender: meta?.gender ?? "unknown",
      quality,
      onnxPath: join(VOICES_DIR, `${id}.onnx`),
      sampleRate,
    };
  });

  if (locale) {
    const norm = locale.toLowerCase().replace("_", "-");
    return voices.filter((v) => v.language.toLowerCase().replace("_", "-") === norm);
  }

  return voices;
}

export function getVoice(id: string): VoiceInfo | undefined {
  return listVoices().find((v) => v.id === id);
}

