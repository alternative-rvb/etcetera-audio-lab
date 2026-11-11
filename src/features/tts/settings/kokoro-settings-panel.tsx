"use client";

import type { KokoroSettings } from "@/lib/shared/types";
import { SettingSlider } from "@/components/ui/form-controls";

// SECTION: Réglages Kokoro (vitesse de lecture).

export function KokoroSettingsPanel({ settings, onChange }: { settings: KokoroSettings; onChange: (settings: KokoroSettings) => void }) {
  return (
    <SettingSlider
      label="Vitesse"
      value={settings.speed}
      min={0.5}
      max={2}
      step={0.05}
      format={(v) => `× ${v.toFixed(2)}`}
      hint="Le premier appel charge le modèle ONNX (quelques secondes)."
      onChange={(speed) => onChange({ speed })}
    />
  );
}
