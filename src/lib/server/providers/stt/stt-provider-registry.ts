import "server-only";
import { groqProvider } from "./groq/groq-provider";
import { sherpaProvider } from "./sherpa/sherpa-provider";
import type { ServerSttProvider } from "./stt-provider.types";
import { whisperProvider } from "./whisper/whisper-provider";

// SECTION: Registre des providers STT exécutés côté serveur.

export const SERVER_STT_PROVIDERS: Record<ServerSttProvider["id"], ServerSttProvider> = {
  whisper: whisperProvider,
  sherpa: sherpaProvider,
  groq: groqProvider,
};
