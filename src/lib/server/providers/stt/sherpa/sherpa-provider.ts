import "server-only";
import { fetchPythonServiceHealth } from "@/lib/server/core/python-service-health";
import { combineHealth, runWithFallback } from "@/lib/server/core/runtime-fallback";
import { hasSherpaModel, loadSherpa, SHERPA_NUM_THREADS, SHERPA_SETUP_HINT, sherpaModelPath } from "@/lib/server/core/sherpa-runtime";
import type { ProviderHealth } from "@/lib/shared/types";
import { transcribeWithFasterWhisper } from "../whisper/whisper-provider";
import type { ServerSttProvider, SttTranscriptionInput } from "../stt-provider.types";
import { transcribeWithSherpa } from "../sherpa-asr";

// SECTION: Provider Sherpa-ONNX : NVIDIA Parakeet TDT 0.6B v3 (25 langues européennes, détection automatique)
// exécuté en Node par sherpa-onnx-node, sur CPU. Secours : Whisper tiny du service Python.

const PARAKEET_DIR = "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8";
export const PARAKEET_MODEL_LABEL = "parakeet-tdt-0.6b-v3";

function transcribeWithParakeet(input: SttTranscriptionInput) {
  return transcribeWithSherpa({
    provider: "sherpa",
    audio: input.audio,
    recognizerKey: PARAKEET_MODEL_LABEL,
    recognizerConfig: () => ({
      featConfig: { sampleRate: 16000, featureDim: 80 },
      modelConfig: {
        transducer: {
          encoder: sherpaModelPath("sherpa", PARAKEET_DIR, "encoder.int8.onnx"),
          decoder: sherpaModelPath("sherpa", PARAKEET_DIR, "decoder.int8.onnx"),
          joiner: sherpaModelPath("sherpa", PARAKEET_DIR, "joiner.int8.onnx"),
        },
        tokens: sherpaModelPath("sherpa", PARAKEET_DIR, "tokens.txt"),
        modelType: "nemo_transducer",
        numThreads: SHERPA_NUM_THREADS,
        provider: "cpu",
        debug: false,
      },
    }),
    maxSegmentSec: 30,
    language: input.language,
    modelSize: PARAKEET_MODEL_LABEL,
    signal: input.signal,
  });
}

async function parakeetNodeHealth(): Promise<ProviderHealth> {
  try {
    await loadSherpa("sherpa");
  } catch {
    return { status: "down", reason: "sherpa-onnx-node indisponible.", hint: "Lancez `npm install`." };
  }
  if (!hasSherpaModel(PARAKEET_DIR) || !hasSherpaModel("silero_vad.onnx")) {
    return { status: "down", reason: "Modèle Parakeet absent de models/sherpa/.", hint: SHERPA_SETUP_HINT };
  }
  return { status: "ok", details: { runtime: "node", model: PARAKEET_MODEL_LABEL } };
}

export const sherpaProvider: ServerSttProvider = {
  id: "sherpa",
  async transcribe(input) {
    const { result, fallback } = await runWithFallback({
      provider: "sherpa",
      primaryLabel: "Parakeet en Node",
      fallbackLabel: "Whisper tiny du service Python",
      signal: input.signal,
      primary: () => transcribeWithParakeet(input),
      fallback: async () => {
        const whisper = await transcribeWithFasterWhisper({ ...input, modelSize: "tiny", device: "cpu" }, "sherpa");
        return { ...whisper, modelSize: "whisper-tiny (secours)" };
      },
    });
    return { ...result, fallback };
  },
  async checkHealth() {
    const [node, python] = await Promise.all([parakeetNodeHealth(), fetchPythonServiceHealth()]);
    return combineHealth(node, python, "Whisper tiny (Python)");
  },
};
