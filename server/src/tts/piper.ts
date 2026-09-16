import { spawn } from "node:child_process";
import { join } from "node:path";
import { getVoice } from "./voices.js";

const PIPER_BIN = join(import.meta.dirname, "..", "..", "bin", "piper");

export interface SynthesizeOptions {
  lengthScale?: number;
  noiseScale?: number;
  noiseW?: number;
}

export async function synthesize(
  text: string,
  voiceId: string,
  options: SynthesizeOptions = {}
): Promise<Buffer> {
  const voice = getVoice(voiceId);
  if (!voice) {
    throw new Error(`Voix inconnue : ${voiceId}`);
  }

  const args = ["--model", voice.onnxPath, "--output_raw"];
  if (options.lengthScale !== undefined) {
    args.push("--length_scale", String(options.lengthScale));
  }
  if (options.noiseScale !== undefined) {
    args.push("--noise_scale", String(options.noiseScale));
  }
  if (options.noiseW !== undefined) {
    args.push("--noise_w", String(options.noiseW));
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(PIPER_BIN, args);

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    proc.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
    proc.stderr.on("data", (chunk) => stderrChunks.push(chunk));

    proc.on("error", (err) => {
      reject(new Error(`Impossible de lancer Piper : ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Piper a échoué (code ${code}) : ${Buffer.concat(stderrChunks).toString("utf-8")}`));
        return;
      }
      const rawAudio = Buffer.concat(stdoutChunks);
      resolve(wrapWav(rawAudio, voice.sampleRate));
    });

    proc.stdin.write(text);
    proc.stdin.end();
  });
}

function wrapWav(rawPcm: Buffer, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = rawPcm.length;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, rawPcm]);
}
