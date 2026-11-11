import "server-only";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { AppError } from "@/lib/server/core/errors";
import { createLogger } from "@/lib/server/core/logger";
import { PROJECT_PATHS } from "@/lib/server/core/paths";
import { wrapPcm16MonoAsWav } from "@/lib/server/core/wav-encoding";
import { nativeBinaryEnv } from "@/lib/server/core/native-binaries";
import { ESPEAK_BINARY_PATH } from "@/lib/server/core/espeak";
import { combineHealth, runWithFallback } from "@/lib/server/core/runtime-fallback";
import { loadSherpa, SHERPA_SETUP_HINT } from "@/lib/server/core/sherpa-runtime";
import type { EngineRuntime, PiperSettings, ProviderHealth } from "@/lib/shared/types";
import type { TtsProvider } from "../tts-provider.types";
import { findPiperVoice, listPiperVoices, type PiperVoice } from "./piper-voice-catalog";
import { synthesizePiperWithSherpa } from "./piper-sherpa";

// SECTION: Provider Piper : exécution principale en Node (sherpa-onnx-node), secours par le binaire natif
// lancé via child_process (dépôt rhasspy/piper archivé, voix de voices/).

const piperLogger = createLogger("piper");
const PIPER_BINARY_PATH = join(PROJECT_PATHS.binDir, "piper");
const PIPER_TIMEOUT_MS = 60_000;
const PIPER_SETUP_HINT = "Lancez `npm run setup` pour télécharger le binaire Piper et les voix.";

function runPiperProcess(args: string[], text: string, signal?: AbortSignal): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PIPER_BINARY_PATH, args, { env: nativeBinaryEnv() });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      fn();
    };

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      const err = new Error(`Piper : délai de ${PIPER_TIMEOUT_MS / 1000} s dépassé.`);
      err.name = "TimeoutError";
      finish(() => reject(err));
    }, PIPER_TIMEOUT_MS);

    const onAbort = () => {
      proc.kill("SIGKILL");
      const err = new Error("Synthèse Piper annulée.");
      err.name = "AbortError";
      finish(() => reject(err));
    };
    signal?.addEventListener("abort", onAbort);

    proc.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    proc.on("error", (err) =>
      finish(() =>
        reject(new AppError("ENGINE_UNAVAILABLE", `Impossible de lancer Piper : ${err.message}`, {
          provider: "piper",
          hint: PIPER_SETUP_HINT,
          cause: err,
        }))
      )
    );
    proc.on("close", (code) => {
      const stderr = Buffer.concat(stderrChunks).toString("utf-8").trim();
      if (stderr) piperLogger.debug("process.stderr", stderr.slice(-2000));
      if (code !== 0) {
        finish(() =>
          reject(new AppError("ENGINE_FAILED", `Piper s'est arrêté avec le code ${code}.`, {
            provider: "piper",
            details: { exitCode: code, stderr: stderr.slice(-1000) },
          }))
        );
        return;
      }
      finish(() => resolve(Buffer.concat(stdoutChunks)));
    });

    proc.stdin.on("error", () => {
      // NOTE: EPIPE si le process meurt avant la lecture, l'erreur réelle arrive via "close".
    });
    proc.stdin.write(text);
    proc.stdin.end();
  });
}

export const piperProvider: TtsProvider<"piper"> = {
  id: "piper",

  settingsSchema: z.object({
    lengthScale: z.number().min(0.5).max(2),
    noiseScale: z.number().min(0).max(1),
    noiseW: z.number().min(0).max(1),
  }),

  async listVoices(locale) {
    return {
      provider: "piper",
      voices: listPiperVoices(locale).map(({ sampleRate: _s, espeakVoice: _e, sherpaDir: _d, binaryOnnxPath: _b, ...voice }) => voice),
    };
  },

  async synthesize({ text, voiceId, settings, signal }) {
    const voice = findPiperVoice(voiceId);
    if (!voice) throw new AppError("VOICE_NOT_FOUND", `Voix Piper inconnue : ${voiceId}.`, { provider: "piper" });

    const startedAt = performance.now();
    const { result, fallback } = await runWithFallback<{ audio: Buffer; sampleRate: number; runtime: EngineRuntime }>({
      provider: "piper",
      primaryLabel: "Piper en Node",
      fallbackLabel: "binaire Piper",
      signal,
      primary: async () => ({ ...(await synthesizePiperWithSherpa(voice, text, settings)), runtime: "node" as const }),
      fallback: async () => ({ ...(await synthesizeWithBinary(voice, text, settings, signal)), runtime: "binary" as const }),
    });
    return {
      audio: result.audio,
      format: "wav",
      voiceName: voice.name,
      runtime: result.runtime,
      fallback,
      diagnostics: { sampleRate: result.sampleRate, engineMs: Math.round(performance.now() - startedAt) },
    };
  },

  async checkHealth() {
    return combineHealth(await checkNodeHealth(), checkBinaryHealth(), "binaire Piper");
  },
};

// SECTION: Exécution Node et secours binaire

async function checkNodeHealth(): Promise<ProviderHealth> {
  try {
    await loadSherpa("piper");
  } catch (err) {
    return { status: "down", reason: err instanceof AppError ? err.message : "sherpa-onnx-node indisponible.", hint: "Lancez `npm install`." };
  }
  const voices = listPiperVoices().filter((voice) => voice.sherpaDir);
  if (voices.length === 0) return { status: "down", reason: "Aucune voix Piper dans models/sherpa/.", hint: SHERPA_SETUP_HINT };
  if (!existsSync(ESPEAK_BINARY_PATH)) return { status: "down", reason: "espeak-ng absent de bin/.", hint: PIPER_SETUP_HINT };
  return { status: "ok", details: { runtime: "node", voices: voices.length } };
}

function checkBinaryHealth(): ProviderHealth {
  if (!existsSync(PIPER_BINARY_PATH)) return { status: "down", reason: "Binaire bin/piper absent.", hint: PIPER_SETUP_HINT };
  const voices = listPiperVoices().filter((voice) => voice.binaryOnnxPath && existsSync(voice.binaryOnnxPath));
  if (voices.length === 0) return { status: "down", reason: "Aucune voix dans voices/.", hint: PIPER_SETUP_HINT };
  return { status: "ok", details: { runtime: "binary", voices: voices.length } };
}

async function synthesizeWithBinary(voice: PiperVoice, text: string, settings: PiperSettings, signal?: AbortSignal) {
  if (!existsSync(PIPER_BINARY_PATH)) {
    throw new AppError("ENGINE_UNAVAILABLE", "Binaire Piper introuvable dans bin/.", { provider: "piper", hint: PIPER_SETUP_HINT });
  }
  if (!voice.binaryOnnxPath || !existsSync(voice.binaryOnnxPath)) {
    throw new AppError("ENGINE_UNAVAILABLE", `Modèle ONNX manquant dans voices/ pour la voix ${voice.name}.`, {
      provider: "piper",
      hint: PIPER_SETUP_HINT,
    });
  }
  const args = [
    "--model", voice.binaryOnnxPath,
    "--output_raw",
    "--length_scale", String(settings.lengthScale),
    "--noise_scale", String(settings.noiseScale),
    "--noise_w", String(settings.noiseW),
  ];
  const rawPcm = await runPiperProcess(args, text, signal);
  if (rawPcm.length === 0) {
    throw new AppError("ENGINE_FAILED", "Piper n'a produit aucun échantillon audio.", { provider: "piper" });
  }
  return { audio: wrapPcm16MonoAsWav(rawPcm, voice.sampleRate), sampleRate: voice.sampleRate };
}
