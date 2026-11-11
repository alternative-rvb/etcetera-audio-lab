import "server-only";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { TtsVoice, VoiceGender } from "@/lib/shared/types";
import { PROJECT_PATHS } from "@/lib/server/core/paths";
import { createLogger } from "@/lib/server/core/logger";
import { filterVoicesByLocale } from "../tts-voice-utils";

// SECTION: Catalogue des voix Piper, construit en scannant models/sherpa/vits-piper-*/ (exécution Node)
// et voices/*.onnx.json (binaire Piper, secours). Une voix est listée dès qu'un des deux emplacements l'a.

const piperLogger = createLogger("piper");
const SHERPA_PIPER_PREFIX = "vits-piper-";

export interface PiperVoice extends TtsVoice {
  sampleRate: number;
  /** Voix espeak-ng utilisée pour la phonémisation (ex. "fr"). */
  espeakVoice: string;
  /** Dossier models/sherpa/vits-piper-<id>/ si la voix est disponible en Node. */
  sherpaDir?: string;
  /** Fichier voices/<id>.onnx si la voix est disponible pour le binaire. */
  binaryOnnxPath?: string;
}

const PIPER_VOICE_DISPLAY_NAMES: Record<string, { name: string; gender: VoiceGender }> = {
  "fr_FR-siwis-medium": { name: "Siwis", gender: "female" },
  "fr_FR-upmc-medium": { name: "UPMC", gender: "female" },
  "fr_FR-tom-medium": { name: "Tom", gender: "male" },
  "fr_FR-gilles-low": { name: "Gilles", gender: "male" },
  "en_US-lessac-medium": { name: "Lessac", gender: "female" },
};

function readVoiceConfig(id: string, configPath: string): Omit<PiperVoice, "sherpaDir" | "binaryOnnxPath"> | null {
  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const known = PIPER_VOICE_DISPLAY_NAMES[id];
    return {
      id,
      name: known?.name ?? config.dataset ?? id,
      language: (config.language?.code ?? config.language?.family ?? "unknown").replace("_", "-"),
      gender: known?.gender ?? "unknown",
      quality: config.audio?.quality ?? "medium",
      sampleRate: config.audio?.sample_rate ?? 22050,
      espeakVoice: config.espeak?.voice ?? config.language?.family ?? "fr",
    };
  } catch (err) {
    piperLogger.warn("voices.invalid_config", `Configuration de voix illisible : ${configPath}`, { error: err });
    return null;
  }
}

export function listPiperVoices(locale?: string): PiperVoice[] {
  const voices = new Map<string, PiperVoice>();

  const sherpaRoot = PROJECT_PATHS.sherpaModelsDir;
  if (existsSync(sherpaRoot)) {
    for (const dirName of readdirSync(sherpaRoot).filter((name) => name.startsWith(SHERPA_PIPER_PREFIX))) {
      const id = dirName.slice(SHERPA_PIPER_PREFIX.length);
      const dir = join(sherpaRoot, dirName);
      if (!existsSync(join(dir, `${id}.onnx`))) continue;
      const base = readVoiceConfig(id, join(dir, `${id}.onnx.json`));
      if (base) voices.set(id, { ...base, sherpaDir: dir });
    }
  }

  const binaryDir = PROJECT_PATHS.piperVoicesDir;
  if (existsSync(binaryDir)) {
    for (const file of readdirSync(binaryDir).filter((f) => f.endsWith(".onnx.json"))) {
      const id = file.replace(/\.onnx\.json$/, "");
      const onnxPath = join(binaryDir, `${id}.onnx`);
      const existing = voices.get(id);
      if (existing) {
        existing.binaryOnnxPath = onnxPath;
        continue;
      }
      const base = readVoiceConfig(id, join(binaryDir, file));
      if (base) voices.set(id, { ...base, binaryOnnxPath: onnxPath });
    }
  }

  return filterVoicesByLocale([...voices.values()], locale);
}

export function findPiperVoice(voiceId: string): PiperVoice | undefined {
  return listPiperVoices().find((voice) => voice.id === voiceId);
}
