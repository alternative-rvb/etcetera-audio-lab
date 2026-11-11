import "server-only";
import { existsSync } from "node:fs";
import { KokoroTTS } from "kokoro-js";
import { z } from "zod";
import { AppError } from "@/lib/server/core/errors";
import { createLogger } from "@/lib/server/core/logger";
import { withTimeout } from "@/lib/server/core/timeout";
import { filterVoicesByLocale } from "../tts-voice-utils";
import type { TtsProvider } from "../tts-provider.types";
import { ESPEAK_BINARY_PATH, phonemizeFrenchText } from "./kokoro-french-phonemizer";
import { KOKORO_VOICES } from "./kokoro-voices";

// SECTION: Provider Kokoro-82M (ONNX local via kokoro-js / onnxruntime-node).

const kokoroLogger = createLogger("kokoro");
const KOKORO_MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const KOKORO_MODEL_LOAD_TIMEOUT_MS = 5 * 60_000;
const KOKORO_SYNTHESIS_TIMEOUT_MS = 2 * 60_000;

type KokoroVoiceKey = NonNullable<NonNullable<Parameters<KokoroTTS["generate"]>[1]>["voice"]>;

interface KokoroModelState {
  instance: KokoroTTS | null;
  loading: Promise<KokoroTTS> | null;
  lastLoadError: string | null;
}

// NOTE: singleton sur globalThis pour ne pas recharger le modèle à chaque HMR.
const globalForKokoro = globalThis as typeof globalThis & { __etceteraKokoro?: KokoroModelState };
const kokoroState: KokoroModelState = (globalForKokoro.__etceteraKokoro ??= { instance: null, loading: null, lastLoadError: null });

async function loadKokoroModel(): Promise<KokoroTTS> {
  if (kokoroState.instance) return kokoroState.instance;
  if (!kokoroState.loading) {
    const startedAt = performance.now();
    kokoroLogger.info("model.loading", `Chargement de ${KOKORO_MODEL_ID} (q8). Le premier lancement télécharge le modèle.`);
    kokoroState.loading = withTimeout(
      KokoroTTS.from_pretrained(KOKORO_MODEL_ID, { dtype: "q8" }),
      KOKORO_MODEL_LOAD_TIMEOUT_MS,
      "Chargement Kokoro"
    )
      .then((instance) => {
        // NOTE: lève la restriction de kokoro-js aux voix anglaises pour accepter ff_siwis.
        (instance as unknown as { _validate_voice: (v: string) => string })._validate_voice = (v: string) => v.at(0) ?? "a";
        kokoroState.instance = instance;
        kokoroState.lastLoadError = null;
        kokoroLogger.info("model.loaded", "Modèle Kokoro prêt.", { durationMs: Math.round(performance.now() - startedAt) });
        return instance;
      })
      .catch((err: unknown) => {
        // FIXME: avant la migration, une promesse rejetée restait en cache et bloquait Kokoro jusqu'au redémarrage.
        kokoroState.loading = null;
        kokoroState.lastLoadError = err instanceof Error ? err.message : String(err);
        kokoroLogger.error("model.load_failed", "Échec du chargement du modèle Kokoro.", { error: err });
        throw new AppError("ENGINE_UNAVAILABLE", "Le modèle Kokoro n'a pas pu être chargé.", {
          provider: "kokoro",
          hint: "Vérifiez la connexion à HuggingFace (premier téléchargement) puis réessayez.",
          cause: err,
        });
      });
  }
  return kokoroState.loading;
}

function isFrenchVoice(voiceId: string): boolean {
  const voice = KOKORO_VOICES.find((v) => v.id === voiceId);
  return voice ? voice.language.startsWith("fr") : voiceId.startsWith("f");
}

export const kokoroProvider: TtsProvider<"kokoro"> = {
  id: "kokoro",

  settingsSchema: z.object({ speed: z.number().min(0.5).max(2) }),

  async listVoices(locale) {
    return { provider: "kokoro", voices: filterVoicesByLocale(KOKORO_VOICES, locale) };
  },

  async synthesize({ text, voiceId, settings }) {
    const voice = KOKORO_VOICES.find((v) => v.id === voiceId);
    if (!voice) throw new AppError("VOICE_NOT_FOUND", `Voix Kokoro inconnue : ${voiceId}.`, { provider: "kokoro" });

    const wasLoaded = kokoroState.instance !== null;
    const tts = await loadKokoroModel();
    const voiceKey = voice.id as KokoroVoiceKey;

    const generation = (async () => {
      if (isFrenchVoice(voice.id)) {
        const phonemes = await phonemizeFrenchText(text);
        kokoroLogger.debug("phonemes.ready", `${phonemes.length} caractères IPA générés.`);
        const { input_ids } = tts.tokenizer(phonemes, { truncation: true });
        return tts.generate_from_ids(input_ids, { voice: voiceKey, speed: settings.speed });
      }
      return tts.generate(text, { voice: voiceKey, speed: settings.speed });
    })();

    const audio = await withTimeout(generation, KOKORO_SYNTHESIS_TIMEOUT_MS, "Synthèse Kokoro");
    return {
      audio: Buffer.from(audio.toWav()),
      format: "wav",
      voiceName: voice.name,
      diagnostics: { coldStart: !wasLoaded, phonemizer: isFrenchVoice(voice.id) ? "espeak-ng" : "kokoro-js" },
    };
  },

  async checkHealth() {
    if (!existsSync(ESPEAK_BINARY_PATH)) {
      return { status: "degraded", reason: "espeak-ng absent : seules les voix anglaises fonctionnent.", hint: "Lancez `npm run setup`." };
    }
    if (kokoroState.lastLoadError) {
      return { status: "degraded", reason: `Dernier chargement en échec : ${kokoroState.lastLoadError}` };
    }
    return {
      status: "ok",
      details: { modelLoaded: kokoroState.instance !== null, loading: kokoroState.loading !== null && !kokoroState.instance },
    };
  },
};
