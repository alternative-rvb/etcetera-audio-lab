"use client";

import { SettingChoice } from "@/components/ui/form-controls";
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
    <div className="space-y-2.5">
      <SettingChoice
        label="Langue"
        value={settings.language}
        options={[
          { value: "fr-FR", label: "Français" },
          { value: "en-US", label: "Anglais" },
          { value: "es-ES", label: "Espagnol" },
        ]}
        onChange={(language) => onChange({ language })}
      />
      {!supported && <p className="text-xs text-danger">Ce navigateur ne propose pas la Web Speech API. Utilisez Chrome ou Edge.</p>}
    </div>
  );
}
