"use client";

import type { PiperSettings } from "@/lib/shared/types";
import { SettingSlider } from "@/components/ui/form-controls";

// SECTION: Réglages Piper (vitesse, variabilité de l'intonation et de la durée des phonèmes).

export function PiperSettingsPanel({ settings, onChange }: { settings: PiperSettings; onChange: (settings: PiperSettings) => void }) {
  return (
    <div className="space-y-3">
      <SettingSlider
        label="Lenteur (length scale)"
        value={settings.lengthScale}
        min={0.5}
        max={2}
        step={0.05}
        hint="Au-dessus de 1, la voix ralentit."
        onChange={(lengthScale) => onChange({ ...settings, lengthScale })}
      />
      <SettingSlider
        label="Expressivité (noise scale)"
        value={settings.noiseScale}
        min={0}
        max={1}
        step={0.01}
        hint="Variations d'intonation, 0,667 par défaut."
        onChange={(noiseScale) => onChange({ ...settings, noiseScale })}
      />
      <SettingSlider
        label="Rythme (noise W)"
        value={settings.noiseW}
        min={0}
        max={1}
        step={0.01}
        hint="Variations de durée des phonèmes, 0,8 par défaut."
        onChange={(noiseW) => onChange({ ...settings, noiseW })}
      />
    </div>
  );
}
