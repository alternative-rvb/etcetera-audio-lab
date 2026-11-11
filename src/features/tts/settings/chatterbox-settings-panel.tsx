"use client";

import type { ChatterboxSettings, ProviderHealth } from "@/lib/shared/types";
import { SettingChoice, SettingSlider } from "@/components/ui/form-controls";

// SECTION: Réglages Chatterbox (matériel d'exécution, exagération émotionnelle, température).

export function ChatterboxSettingsPanel({
  settings,
  onChange,
  pythonServiceHealth,
}: {
  settings: ChatterboxSettings;
  onChange: (settings: ChatterboxSettings) => void;
  pythonServiceHealth?: ProviderHealth;
}) {
  const cudaAvailable = pythonServiceHealth?.details?.cuda_available;
  return (
    <div className="space-y-3">
      <SettingChoice
        label="Matériel"
        value={settings.device}
        options={[
          { value: "cpu", label: "CPU" },
          { value: "cuda", label: "GPU CUDA", disabledReason: cudaAvailable === false ? "Aucun GPU CUDA détecté par le service Python." : undefined },
        ]}
        note={settings.device === "cpu" ? "Sur CPU, comptez plusieurs dizaines de secondes par phrase." : undefined}
        onChange={(device) => onChange({ ...settings, device })}
      />
      <SettingSlider
        label="Exagération émotionnelle"
        value={settings.exaggeration}
        min={0}
        max={1.5}
        step={0.05}
        hint="0,5 = neutre. Au-delà, le ton devient plus appuyé."
        onChange={(exaggeration) => onChange({ ...settings, exaggeration })}
      />
      <SettingSlider
        label="Température"
        value={settings.temperature}
        min={0.1}
        max={1.2}
        step={0.05}
        hint="Plus haut = plus de variété, plus de risques d'artefacts."
        onChange={(temperature) => onChange({ ...settings, temperature })}
      />
    </div>
  );
}
