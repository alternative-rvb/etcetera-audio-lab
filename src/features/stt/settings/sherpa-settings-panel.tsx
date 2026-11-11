"use client";

import { SettingSelect } from "@/components/ui/form-controls";
import { WHISPER_LANGUAGE_OPTIONS, type SherpaSettings } from "../stt-settings";

// SECTION: Réglages Sherpa-ONNX.
// FIXME: Sherpa est encore un substitut (Whisper tiny/base sur CPU), voir le ticket 22 du backlog.

export function SherpaSettingsPanel({ settings, onChange }: { settings: SherpaSettings; onChange: (settings: SherpaSettings) => void }) {
  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
        Provisoire : en attendant l'intégration de sherpa-onnx, cette option exécute Whisper sur CPU.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingSelect
          label="Modèle"
          value={settings.modelSize}
          options={[
            { value: "tiny", label: "Tiny (ultra-léger)" },
            { value: "base", label: "Base (standard)" },
          ]}
          onChange={(modelSize) => onChange({ ...settings, modelSize })}
        />
        <SettingSelect label="Langue" value={settings.language} options={WHISPER_LANGUAGE_OPTIONS} onChange={(language) => onChange({ ...settings, language })} />
      </div>
    </div>
  );
}
