"use client";

import type { ProviderHealth } from "@/lib/shared/types";
import { SettingChoice, SettingSwitch } from "@/components/ui/form-controls";
import { WHISPER_LANGUAGE_OPTIONS, type WhisperSettings } from "../stt-settings";

// SECTION: Réglages Whisper (taille du modèle, matériel, langue, horodatage mot à mot).
// NOTE: CPU = exécution dans Node (sherpa-onnx), CUDA = service Python (Faster-Whisper), seul à fournir les mots horodatés.

export function WhisperSettingsPanel({
  settings,
  onChange,
  pythonServiceHealth,
}: {
  settings: WhisperSettings;
  onChange: (settings: WhisperSettings) => void;
  pythonServiceHealth?: ProviderHealth;
}) {
  const cudaAvailable = pythonServiceHealth?.details?.cuda_available;
  return (
    <div className="space-y-2.5">
      <SettingChoice
        label="Modèle"
        value={settings.modelSize}
        hint="Plus le modèle est gros, plus il est précis et lent. Le premier appel télécharge puis charge le modèle."
        options={[
          { value: "tiny", label: "Tiny", detail: "39M" },
          { value: "base", label: "Base", detail: "74M" },
          { value: "small", label: "Small", detail: "244M" },
          { value: "medium", label: "Medium", detail: "769M" },
        ]}
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
