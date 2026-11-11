import "server-only";
import { z } from "zod";
import type { TtsVoice, VoiceGender } from "@/lib/shared/types";
import { AppError } from "@/lib/server/core/errors";
import { createLogger } from "@/lib/server/core/logger";
import { PYTHON_SERVICE_START_HINT } from "@/lib/server/core/paths";
import { callPythonService } from "@/lib/server/core/python-service-client";
import { fetchPythonServiceHealth } from "@/lib/server/core/python-service-health";
import type { TtsProvider } from "../tts-provider.types";

// SECTION: Provider Chatterbox (clonage vocal zéro-shot, exécuté par le service Python python/tts/chatterbox.py).

const chatterboxLogger = createLogger("chatterbox");
const CHATTERBOX_SYNTHESIS_TIMEOUT_MS = 5 * 60_000;
const CHATTERBOX_REFERENCES_TIMEOUT_MS = 3_000;
const CHATTERBOX_REPETITION_PENALTY = 2.0;

const FALLBACK_REFERENCE_VOICES: TtsVoice[] = [
  { id: "reference_female.wav", name: "Voix féminine (clonage)", language: "fr-FR", gender: "female", quality: "Référence" },
  { id: "reference_male.wav", name: "Voix masculine (clonage)", language: "fr-FR", gender: "male", quality: "Référence" },
];

function guessGenderFromReferenceName(name: string): VoiceGender {
  const lower = name.toLowerCase();
  if (lower.includes("female") || lower.includes("femme")) return "female";
  if (lower.includes("male") || lower.includes("homme")) return "male";
  return "unknown";
}

async function fetchReferenceVoices(): Promise<TtsVoice[]> {
  const response = await callPythonService("/references", { provider: "chatterbox", timeoutMs: CHATTERBOX_REFERENCES_TIMEOUT_MS });
  const references = (await response.json()) as Array<{ id: string; name: string }>;
  return references.map((ref) => ({
    id: ref.id,
    name: ref.name,
    language: "fr-FR",
    gender: guessGenderFromReferenceName(ref.name),
    quality: "Référence",
  }));
}

export const chatterboxProvider: TtsProvider<"chatterbox"> = {
  id: "chatterbox",

  settingsSchema: z.object({
    device: z.enum(["cpu", "cuda"]),
    exaggeration: z.number().min(0).max(1.5),
    temperature: z.number().min(0.1).max(1.2),
  }),

  async listVoices() {
    try {
      return { provider: "chatterbox", voices: await fetchReferenceVoices() };
    } catch (err) {
      // NOTE: on garde des voix de secours affichables, mais l'UI est prévenue (degraded) au lieu d'un repli silencieux.
      const reason = err instanceof AppError ? err.message : "Références indisponibles.";
      chatterboxLogger.warn("voices.fallback", `Voix de secours utilisées : ${reason}`, { error: err });
      return { provider: "chatterbox", voices: FALLBACK_REFERENCE_VOICES, degraded: true, degradedReason: `${reason} ${PYTHON_SERVICE_START_HINT}` };
    }
  },

  async synthesize({ text, voiceId, settings, signal }) {
    const response = await callPythonService("/tts", {
      provider: "chatterbox",
      method: "POST",
      timeoutMs: CHATTERBOX_SYNTHESIS_TIMEOUT_MS,
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        language: "fr",
        reference_name: voiceId,
        device: settings.device,
        exaggeration: settings.exaggeration,
        temperature: settings.temperature,
        repetition_penalty: CHATTERBOX_REPETITION_PENALTY,
      }),
    });
    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length === 0) {
      throw new AppError("ENGINE_FAILED", "Chatterbox a renvoyé un audio vide.", { provider: "chatterbox" });
    }

    let voiceName = voiceId;
    try {
      voiceName = (await fetchReferenceVoices()).find((v) => v.id === voiceId)?.name ?? voiceId;
    } catch {
      // NOTE: nom d'affichage seulement, l'audio est déjà produit.
    }
    return { audio, format: "wav", voiceName, diagnostics: { device: settings.device } };
  },

  async checkHealth() {
    const python = await fetchPythonServiceHealth();
    if (python.status !== "ok") return { ...python, reason: python.reason ?? "Service Python indisponible." };
    return {
      status: "ok",
      details: {
        modelLoaded: python.details?.tts_loaded ?? false,
        loadedDevices: python.details?.loaded_tts_devices ?? [],
        cudaAvailable: python.details?.cuda_available ?? false,
      },
    };
  },
};
