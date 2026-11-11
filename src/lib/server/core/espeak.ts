import "server-only";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { AppError, type ProviderId } from "./errors";
import { nativeBinaryEnv } from "./native-binaries";
import { PROJECT_PATHS } from "./paths";

// SECTION: Phonémisation IPA via espeak-ng (livré avec l'archive Piper dans bin/), utilisée par Kokoro et par Piper en Node.
// NOTE: le texte passe par stdin, un texte qui commence par un tiret serait sinon lu comme une option.

export const ESPEAK_BINARY_PATH = join(PROJECT_PATHS.binDir, "espeak-ng");
const ESPEAK_TIMEOUT_MS = 15_000;

/**
 * Renvoie une ligne de phonèmes par proposition détectée par espeak-ng.
 * `ipaMode` : "--ipa" (phonèmes collés, format Piper) ou "--ipa=3" (liaisons ZWJ, format Kokoro).
 */
export function espeakToIpaLines(text: string, options: { voice: string; ipaMode: "--ipa" | "--ipa=3"; provider: ProviderId }): Promise<string[]> {
  const { voice, ipaMode, provider } = options;
  if (!existsSync(ESPEAK_BINARY_PATH)) {
    return Promise.reject(
      new AppError("ENGINE_UNAVAILABLE", "espeak-ng introuvable dans bin/.", {
        provider,
        hint: "Lancez `npm run setup` : espeak-ng est livré avec l'archive Piper.",
      })
    );
  }
  return new Promise((resolve, reject) => {
    const proc = spawn(ESPEAK_BINARY_PATH, [`--path=${PROJECT_PATHS.binDir}`, "-v", voice, "-q", ipaMode, "--stdin"], { env: nativeBinaryEnv() });
    const out: Buffer[] = [];
    const timer = setTimeout(() => proc.kill("SIGKILL"), ESPEAK_TIMEOUT_MS);
    proc.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new AppError("ENGINE_FAILED", "La phonémisation espeak-ng a échoué.", { provider, cause: err }));
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new AppError("ENGINE_FAILED", `espeak-ng s'est arrêté avec le code ${code}.`, { provider }));
        return;
      }
      const lines = Buffer.concat(out).toString("utf-8").split("\n").map((line) => line.trim()).filter(Boolean);
      resolve(lines);
    });
    proc.stdin.on("error", () => {
      // NOTE: EPIPE si le process meurt avant la lecture, l'erreur réelle arrive via "close".
    });
    proc.stdin.end(text);
  });
}
