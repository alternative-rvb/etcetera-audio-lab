"use client";

import type { ProviderHealth, SttProviderId } from "@/lib/shared/types";
import type { SttSettingsByProvider } from "../stt-settings";
import { SherpaSettingsPanel } from "./sherpa-settings-panel";
import { WebSpeechSettingsPanel } from "./web-speech-settings-panel";
import { WhisperSettingsPanel } from "./whisper-settings-panel";

// ANCHOR: aiguillage vers le panneau de réglages du provider STT sélectionné (un fichier par provider).
export function SttSettingsPanel({
  provider,
  settings,
  onChange,
  pythonServiceHealth,
  webSpeechSupported,
}: {
  provider: SttProviderId;
  settings: SttSettingsByProvider;
  onChange: <P extends SttProviderId>(provider: P, value: SttSettingsByProvider[P]) => void;
  pythonServiceHealth?: ProviderHealth;
  webSpeechSupported: boolean;
}) {
  switch (provider) {
    case "whisper":
      return <WhisperSettingsPanel settings={settings.whisper} onChange={(value) => onChange("whisper", value)} pythonServiceHealth={pythonServiceHealth} />;
    case "sherpa":
      return <SherpaSettingsPanel settings={settings.sherpa} onChange={(value) => onChange("sherpa", value)} />;
    case "web-speech":
      return <WebSpeechSettingsPanel settings={settings["web-speech"]} onChange={(value) => onChange("web-speech", value)} supported={webSpeechSupported} />;
  }
}
