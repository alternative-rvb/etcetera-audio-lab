"use client";

import type { ProviderHealth } from "@/lib/shared/types";
import { SettingSelect, SettingSwitch } from "@/components/ui/form-controls";
import { WHISPER_LANGUAGE_OPTIONS, type WhisperSettings } from "../stt-settings";

// SECTION: Réglages Whisper (taille du modèle, matériel, langue, horodatage mot à mot).

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
    <div className="grid gap-4 sm:grid-cols-2">
      <SettingSelect
        label="Modèle"
        value={settings.modelSize}
        options={[
          { value: "tiny", label: "Tiny (39M, le plus rapide)" },
          { value: "base", label: "Base (74M, équilibré)" },
          { value: "small", label: "Small (244M, précis)" },
          { value: "medium", label: "Medium (769M, le plus précis)" },
        ]}
        hint="Le premier appel télécharge puis charge le modèle."
        onChange={(modelSize) => onChange({ ...settings, modelSize })}
      />
      <SettingSelect
        label="Matériel"
        value={settings.device}
        options={[
          { value: "cpu", label: "CPU (équivalent VPS)" },
          { value: "cuda", label: cudaAvailable === false ? "GPU CUDA (non détecté)" : "GPU CUDA" },
        ]}
        onChange={(device) => onChange({ ...settings, device })}
      />
      <SettingSelect label="Langue" value={settings.language} options={WHISPER_LANGUAGE_OPTIONS} onChange={(language) => onChange({ ...settings, language })} />
      <div className="flex items-end pb-2">
        <SettingSwitch label="Horodatage mot à mot" checked={settings.wordTimestamps} onChange={(wordTimestamps) => onChange({ ...settings, wordTimestamps })} />
      </div>
    </div>
  );
}
