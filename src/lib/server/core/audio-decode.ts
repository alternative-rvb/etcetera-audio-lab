import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppError, type ProviderId } from "./errors";

// SECTION: Décodage de n'importe quel audio (webm du micro, mp3, m4a, wav) en PCM float 16 kHz mono via ffmpeg.
// NOTE: passage par un fichier temporaire, car certains conteneurs (mp4, m4a) ne se lisent pas depuis un pipe.

export const STT_SAMPLE_RATE = 16_000;
const DECODE_TIMEOUT_MS = 120_000;

export async function decodeAudioToPcm16k(audio: Buffer, options: { provider: ProviderId; signal?: AbortSignal }): Promise<Float32Array> {
  const dir = await mkdtemp(join(tmpdir(), "etcetera-audio-"));
  const inputPath = join(dir, "input");
  try {
    await writeFile(inputPath, audio);
    const raw = await runFfmpeg(["-hide_banner", "-loglevel", "error", "-i", inputPath, "-f", "f32le", "-ac", "1", "-ar", String(STT_SAMPLE_RATE), "pipe:1"], options);
    // NOTE: copie dans un ArrayBuffer neuf, le Buffer de Node n'est pas forcément aligné sur 4 octets.
    const aligned = new Uint8Array(raw.length);
    aligned.set(raw);
    return new Float32Array(aligned.buffer, 0, Math.floor(raw.length / 4));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runFfmpeg(args: string[], { provider, signal }: { provider: ProviderId; signal?: AbortSignal }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];
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
      finish(() => reject(new AppError("TIMEOUT", "Décodage audio trop long (ffmpeg).", { provider })));
    }, DECODE_TIMEOUT_MS);
    const onAbort = () => {
      proc.kill("SIGKILL");
      const err = new Error("Décodage audio annulé.");
      err.name = "AbortError";
      finish(() => reject(err));
    };
    signal?.addEventListener("abort", onAbort);

    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    proc.on("error", (err) =>
      finish(() =>
        reject(new AppError("ENGINE_UNAVAILABLE", "ffmpeg introuvable, nécessaire pour décoder l'audio.", {
          provider,
          hint: "Installez ffmpeg (`sudo apt install ffmpeg`).",
          cause: err,
        }))
      )
    );
    proc.on("close", (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(errors).toString("utf-8").trim().slice(-500);
        finish(() => reject(new AppError("VALIDATION", "Audio illisible : ffmpeg n'a pas pu le décoder.", { provider, details: { exitCode: code, stderr } })));
        return;
      }
      finish(() => resolve(Buffer.concat(chunks)));
    });
  });
}
