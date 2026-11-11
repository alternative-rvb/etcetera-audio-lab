import "server-only";
import { fetchPythonServiceHealth } from "@/lib/server/core/python-service-health";
import { transcribeWithFasterWhisper } from "../whisper/whisper-provider";
import type { ServerSttProvider } from "../stt-provider.types";

// SECTION: Provider Sherpa-ONNX.
// FIXME: implémentation provisoire (backlog id 22) : délègue à Faster-Whisper tiny ou base sur CPU.
// À remplacer par un vrai moteur sherpa-onnx côté Python (python/stt/sherpa.py).

export const sherpaProvider: ServerSttProvider = {
  id: "sherpa",
  async transcribe(input) {
    // NOTE: seuls les modèles légers (tiny, base) sont proposés, comme dans l'ancienne interface.
    const modelSize = input.modelSize === "base" ? "base" : "tiny";
    const result = await transcribeWithFasterWhisper({ ...input, modelSize, device: "cpu" }, "sherpa");
    return { ...result, modelSize: `whisper-${modelSize} (substitut Sherpa)`, device: "cpu" };
  },
  async checkHealth() {
    const python = await fetchPythonServiceHealth();
    if (python.status !== "ok") return python;
    return { status: "degraded", reason: "Substitut provisoire : Whisper tiny CPU (ticket 22)." };
  },
};
