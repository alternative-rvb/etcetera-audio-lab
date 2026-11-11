import "server-only";
import type { HealthReport, ProviderHealth } from "@/lib/shared/types";
import { fetchPythonServiceHealth } from "./core/python-service-health";
import { SERVER_STT_PROVIDERS } from "./providers/stt/stt-provider-registry";
import { TTS_PROVIDERS } from "./providers/tts/tts-provider-registry";

// SECTION: Rapport de santé de tous les providers, affiché sous forme de pastilles dans l'UI.

async function safeCheck(check: () => Promise<ProviderHealth>): Promise<ProviderHealth> {
  try {
    return await check();
  } catch (err) {
    return { status: "down", reason: err instanceof Error ? err.message : String(err) };
  }
}

export async function buildHealthReport(): Promise<HealthReport> {
  const [edge, piper, kokoro, chatterbox, whisper, sherpa, pythonService] = await Promise.all([
    safeCheck(() => TTS_PROVIDERS["edge-tts"].checkHealth()),
    safeCheck(() => TTS_PROVIDERS.piper.checkHealth()),
    safeCheck(() => TTS_PROVIDERS.kokoro.checkHealth()),
    safeCheck(() => TTS_PROVIDERS.chatterbox.checkHealth()),
    safeCheck(() => SERVER_STT_PROVIDERS.whisper.checkHealth()),
    safeCheck(() => SERVER_STT_PROVIDERS.sherpa.checkHealth()),
    fetchPythonServiceHealth(),
  ]);
  return {
    checkedAt: new Date().toISOString(),
    tts: { "edge-tts": edge, piper, kokoro, chatterbox },
    stt: {
      "web-speech": { status: "ok", reason: "Dépend du navigateur (Chrome ou Edge)." },
      whisper,
      sherpa,
    },
    pythonService,
  };
}
