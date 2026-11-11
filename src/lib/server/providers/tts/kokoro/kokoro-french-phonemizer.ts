import "server-only";
import { espeakToIpaLines } from "@/lib/server/core/espeak";

// SECTION: Phonémisation française pour Kokoro via espeak-ng (fourni avec le binaire Piper dans bin/).
// kokoro-js ne gère nativement que l'anglais : pour ff_siwis on lui passe directement des phonèmes IPA.

export { ESPEAK_BINARY_PATH } from "@/lib/server/core/espeak";

export async function phonemizeFrenchText(text: string): Promise<string> {
  const lines = await espeakToIpaLines(text, { voice: "fr", ipaMode: "--ipa=3", provider: "kokoro" });
  return lines.join(" ");
}
