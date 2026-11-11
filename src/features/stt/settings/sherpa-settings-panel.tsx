"use client";

import { SettingChoice } from "@/components/ui/form-controls";
import { WHISPER_LANGUAGE_OPTIONS, type SherpaSettings } from "../stt-settings";

// SECTION: Réglages Sherpa-ONNX.
// FIXME: Sherpa est encore un substitut (Whisper tiny/base sur CPU), voir le ticket 22 du backlog.

export function SherpaSettingsPanel({ settings, onChange }: { settings: SherpaSettings; onChange: (settings: SherpaSettings) => void }) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs text-warning">Provisoire : en attendant l'intégration de sherpa-onnx, ce moteur exécute Whisper sur CPU.</p>
      <SettingChoice
        label="Modèle"
        value={settings.modelSize}
        options={[
          { value: "tiny", label: "Tiny", detail: "39M" },
          { value: "base", label: "Base", detail: "74M" },
        ]}
        onChange={(modelSize) => onChange({ ...settings, modelSize })}
      />
      <SettingChoice label="Langue" value={settings.language} options={WHISPER_LANGUAGE_OPTIONS} onChange={(language) => onChange({ ...settings, language })} />
    </div>
  );
}
