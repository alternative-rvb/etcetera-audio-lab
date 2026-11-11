"use client";

import type { ProviderHealth, TtsProviderId, TtsSettingsByProvider } from "@/lib/shared/types";
import { ChatterboxSettingsPanel } from "./chatterbox-settings-panel";
import { EdgeTtsSettingsPanel } from "./edge-tts-settings-panel";
import { KokoroSettingsPanel } from "./kokoro-settings-panel";
import { PiperSettingsPanel } from "./piper-settings-panel";

// ANCHOR: aiguillage vers le panneau de réglages du provider sélectionné (un fichier par provider).
export function TtsSettingsPanel({
  provider,
  settings,
  onChange,
  pythonServiceHealth,
}: {
  provider: TtsProviderId;
  settings: TtsSettingsByProvider;
  onChange: <P extends TtsProviderId>(provider: P, value: TtsSettingsByProvider[P]) => void;
  pythonServiceHealth?: ProviderHealth;
}) {
  switch (provider) {
    case "edge-tts":
      return <EdgeTtsSettingsPanel settings={settings["edge-tts"]} onChange={(value) => onChange("edge-tts", value)} />;
    case "piper":
      return <PiperSettingsPanel settings={settings.piper} onChange={(value) => onChange("piper", value)} />;
    case "kokoro":
      return <KokoroSettingsPanel settings={settings.kokoro} onChange={(value) => onChange("kokoro", value)} />;
    case "chatterbox":
      return (
        <ChatterboxSettingsPanel
          settings={settings.chatterbox}
          onChange={(value) => onChange("chatterbox", value)}
          pythonServiceHealth={pythonServiceHealth}
        />
      );
  }
}
