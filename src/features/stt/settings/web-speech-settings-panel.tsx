"use client";

import { SettingSelect } from "@/components/ui/form-controls";
import type { WebSpeechSettings } from "../stt-settings";

// SECTION: Réglages Web Speech API (langue de reconnaissance du navigateur).

export function WebSpeechSettingsPanel({
  settings,
  onChange,
  supported,
}: {
  settings: WebSpeechSettings;
  onChange: (settings: WebSpeechSettings) => void;
  supported: boolean;
}) {
  return (
    <div className="space-y-3">
      <SettingSelect
        label="Langue"
        value={settings.language}
        options={[
          { value: "fr-FR", label: "Français (fr-FR)" },
          { value: "en-US", label: "Anglais (en-US)" },
          { value: "es-ES", label: "Espagnol (es-ES)" },
        ]}
        onChange={(language) => onChange({ language })}
      />
      <p className={supported ? "text-xs text-muted" : "rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger"}>
        {supported
          ? "La transcription s'affiche en direct pendant l'enregistrement micro. Les fichiers importés ne sont pas pris en charge."
          : "Ce navigateur ne propose pas la Web Speech API. Utilisez Chrome ou Edge."}
      </p>
    </div>
  );
}
