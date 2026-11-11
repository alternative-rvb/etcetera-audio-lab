import "server-only";
import type { TtsProviderId } from "@/lib/shared/types";
import { chatterboxProvider } from "./chatterbox/chatterbox-provider";
import { edgeTtsProvider } from "./edge-tts/edge-tts-provider";
import { kokoroProvider } from "./kokoro/kokoro-provider";
import { piperProvider } from "./piper/piper-provider";
import type { TtsProvider } from "./tts-provider.types";

// SECTION: Registre des providers TTS. Ajouter un moteur = créer son dossier + l'enregistrer ici.

export const TTS_PROVIDERS: { [P in TtsProviderId]: TtsProvider<P> } = {
  "edge-tts": edgeTtsProvider,
  piper: piperProvider,
  kokoro: kokoroProvider,
  chatterbox: chatterboxProvider,
};

export function getTtsProvider<P extends TtsProviderId>(id: P): TtsProvider<P> {
  return TTS_PROVIDERS[id];
}
