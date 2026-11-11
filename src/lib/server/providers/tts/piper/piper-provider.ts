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
import type { TtsProvider } from "../tts-provider.types";
import { findPiperVoice, listPiperVoices } from "./piper-voice-catalog";

// SECTION: Provider Piper (binaire natif lancé via child_process, voix ONNX locales).

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
    return { provider: "piper", voices: listPiperVoices(locale).map(({ onnxPath: _o, sampleRate: _s, ...voice }) => voice) };
  },

  async synthesize({ text, voiceId, settings, signal }) {
    if (!existsSync(PIPER_BINARY_PATH)) {
      throw new AppError("ENGINE_UNAVAILABLE", "Binaire Piper introuvable dans bin/.", { provider: "piper", hint: PIPER_SETUP_HINT });
    }
    const voice = findPiperVoice(voiceId);
    if (!voice) throw new AppError("VOICE_NOT_FOUND", `Voix Piper inconnue : ${voiceId}.`, { provider: "piper" });
    if (!existsSync(voice.onnxPath)) {
      throw new AppError("ENGINE_UNAVAILABLE", `Modèle ONNX manquant pour la voix ${voice.name}.`, {
        provider: "piper",
        hint: PIPER_SETUP_HINT,
      });
    }

    const args = [
      "--model", voice.onnxPath,
      "--output_raw",
      "--length_scale", String(settings.lengthScale),
      "--noise_scale", String(settings.noiseScale),
      "--noise_w", String(settings.noiseW),
    ];
    const rawPcm = await runPiperProcess(args, text, signal);
    if (rawPcm.length === 0) {
      throw new AppError("ENGINE_FAILED", "Piper n'a produit aucun échantillon audio.", { provider: "piper" });
    }
    return {
      audio: wrapPcm16MonoAsWav(rawPcm, voice.sampleRate),
      format: "wav",
      voiceName: voice.name,
      diagnostics: { sampleRate: voice.sampleRate, pcmBytes: rawPcm.length },
    };
  },

  async checkHealth() {
    if (!existsSync(PIPER_BINARY_PATH)) {
      return { status: "down", reason: "Binaire bin/piper absent.", hint: PIPER_SETUP_HINT };
    }
    const voices = listPiperVoices();
    if (voices.length === 0) {
      return { status: "down", reason: "Aucune voix dans voices/.", hint: PIPER_SETUP_HINT };
    }
    return { status: "ok", details: { voices: voices.length } };
  },
};
