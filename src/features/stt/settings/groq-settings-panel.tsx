"use client";

import { SettingChoice, SettingSwitch } from "@/components/ui/form-controls";
import { WHISPER_LANGUAGE_OPTIONS, type GroqSettings } from "../stt-settings";

// SECTION: Réglages Groq Whisper (modèle cloud, langue, horodatage mot à mot).

export function GroqSettingsPanel({ settings, onChange }: { settings: GroqSettings; onChange: (settings: GroqSettings) => void }) {
  return (
    <div className="space-y-2.5">
      <SettingChoice
        label="Modèle"
        value={settings.model}
        hint="Turbo : plus rapide et moins cher (0,04 $/h). Large v3 : un peu plus précis (0,111 $/h). Gratuit dans les limites de l'offre."
        options={[
          { value: "whisper-large-v3-turbo", label: "Large v3 Turbo" },
          { value: "whisper-large-v3", label: "Large v3" },
        ]}
        onChange={(model) => onChange({ ...settings, model })}
      />
      <SettingChoice label="Langue" value={settings.language} options={WHISPER_LANGUAGE_OPTIONS} onChange={(language) => onChange({ ...settings, language })} />
      <SettingSwitch
        label="Horodatage mot à mot"
        hint="Groq ne fournit pas la confiance de chaque mot, seulement son horodatage."
        checked={settings.wordTimestamps}
        onChange={(wordTimestamps) => onChange({ ...settings, wordTimestamps })}
      />
      <p className="text-xs text-muted">L'audio est envoyé à Groq. Fichiers de 25 Mo maximum ; chaque requête compte au moins 10 s d'audio.</p>
    </div>
  );
}
