"use client";

import type { EdgeTtsSettings } from "@/lib/shared/types";
import { SettingSlider } from "@/components/ui/form-controls";

// SECTION: Réglages Edge TTS (débit de parole, en pourcentage du débit normal).

export function EdgeTtsSettingsPanel({ settings, onChange }: { settings: EdgeTtsSettings; onChange: (settings: EdgeTtsSettings) => void }) {
  return (
    <SettingSlider
      label="Débit"
      value={settings.ratePercent}
      min={-50}
      max={50}
      step={5}
      format={(v) => `${v > 0 ? "+" : ""}${v} %`}
      hint="0 % = débit naturel de la voix Microsoft."
      onChange={(ratePercent) => onChange({ ratePercent })}
    />
  );
}
