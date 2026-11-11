import "server-only";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { AppError } from "@/lib/server/core/errors";
import { nativeBinaryEnv } from "@/lib/server/core/native-binaries";
import { PROJECT_PATHS } from "@/lib/server/core/paths";

// SECTION: Phonémisation française pour Kokoro via espeak-ng (fourni avec le binaire Piper dans bin/).
// kokoro-js ne gère nativement que l'anglais : pour ff_siwis on lui passe directement des phonèmes IPA.

const execFileAsync = promisify(execFile);
export const ESPEAK_BINARY_PATH = join(PROJECT_PATHS.binDir, "espeak-ng");

export async function phonemizeFrenchText(text: string): Promise<string> {
  if (!existsSync(ESPEAK_BINARY_PATH)) {
    throw new AppError("ENGINE_UNAVAILABLE", "espeak-ng introuvable dans bin/ (nécessaire pour Kokoro en français).", {
      provider: "kokoro",
      hint: "Lancez `npm run setup` : espeak-ng est livré avec l'archive Piper.",
    });
  }
  try {
    const { stdout } = await execFileAsync(
      ESPEAK_BINARY_PATH,
      [`--path=${PROJECT_PATHS.binDir}`, "-v", "fr", "-q", "--ipa=3", text],
      { env: nativeBinaryEnv(), timeout: 15_000, maxBuffer: 4 * 1024 * 1024 }
    );
    return stdout.trim().replace(/\n+/g, " ");
  } catch (err) {
    throw new AppError("ENGINE_FAILED", "La phonémisation espeak-ng a échoué.", { provider: "kokoro", cause: err });
  }
}
