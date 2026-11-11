"use client";

import type { ProviderHealth } from "@/lib/shared/types";
import { SettingChoice, SettingSwitch } from "@/components/ui/form-controls";
import { WHISPER_LANGUAGE_OPTIONS, type WhisperSettings } from "../stt-settings";

// SECTION: Réglages Whisper (taille du modèle, matériel, langue, horodatage mot à mot).
// NOTE: CPU = exécution dans Node (sherpa-onnx), CUDA = service Python (Faster-Whisper), seul à fournir les mots horodatés.

const MODEL_OPTIONS = [
  { value: "tiny", label: "Tiny", size: "39M" },
  { value: "base", label: "Base", size: "74M" },
  { value: "small", label: "Small", size: "244M" },
  { value: "medium", label: "Medium", size: "769M" },
] as const;

export function WhisperSettingsPanel({
  settings,
  onChange,
  pythonServiceHealth,
  nodeModels,
}: {
  settings: WhisperSettings;
  onChange: (settings: WhisperSettings) => void;
  pythonServiceHealth?: ProviderHealth;
  /** Tailles installées pour Node ; absent tant que la santé est inconnue. */
  nodeModels?: string[];
}) {
  const cudaAvailable = pythonServiceHealth?.details?.cuda_available;
  return (
    <div className="space-y-2.5">
      <SettingChoice
        label="Modèle"
        value={settings.modelSize}
        hint="Plus le modèle est gros, plus il est précis et lent. Le premier appel charge le modèle, comptez plusieurs secondes. « Python » : modèle absent de models/sherpa/, le service Python prend le relais (long, et il doit tourner)."
        options={MODEL_OPTIONS.map(({ value, label, size }) => ({
          value,
          label,
          detail: settings.device === "cpu" && nodeModels && !nodeModels.includes(value) ? `${size}, Python` : size,
        }))}
        onChange={(modelSize) => onChange({ ...settings, modelSize })}
      />
      <SettingChoice
        label="Matériel"
        value={settings.device}
        hint="CPU : exécuté dans l'app (Node), comme sur le VPS, avec le service Python en secours. GPU CUDA : exécuté par le service Python."
        options={[
          { value: "cpu", label: "CPU" },
          { value: "cuda", label: "GPU CUDA", disabledReason: cudaAvailable === false ? "Aucun GPU CUDA détecté par le service Python." : undefined },
        ]}
        onChange={(device) => onChange({ ...settings, device })}
      />
      <SettingChoice label="Langue" value={settings.language} options={WHISPER_LANGUAGE_OPTIONS} onChange={(language) => onChange({ ...settings, language })} />
      <SettingSwitch
        label="Horodatage mot à mot"
        hint="Affiche la confiance de chaque mot dans le résultat."
        disabledReason={settings.device === "cpu" ? "Disponible seulement sur GPU CUDA (service Python) : sur CPU, le résultat est découpé en phrases horodatées." : undefined}
        checked={settings.wordTimestamps}
        onChange={(wordTimestamps) => onChange({ ...settings, wordTimestamps })}
      />
    </div>
  );
}
