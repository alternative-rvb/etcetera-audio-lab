import type { TtsVoice } from "@/lib/shared/types";

// SECTION: Voix Kokoro-82M exposées dans l'interface.

export const KOKORO_VOICES: TtsVoice[] = [
  { id: "ff_siwis", name: "Siwis (France)", language: "fr-FR", gender: "female", quality: "ONNX 82M" },
  { id: "af_heart", name: "Heart (Studio A)", language: "en-US", gender: "female", quality: "Qualité A" },
  { id: "af_bella", name: "Bella (Expressive)", language: "en-US", gender: "female", quality: "Dynamique" },
  { id: "af_nicole", name: "Nicole (Podcast)", language: "en-US", gender: "female", quality: "Narratrice" },
  { id: "am_adam", name: "Adam (Posé)", language: "en-US", gender: "male", quality: "Grave" },
  { id: "am_michael", name: "Michael (Calme)", language: "en-US", gender: "male", quality: "Posé" },
  { id: "bf_emma", name: "Emma (Oxford)", language: "en-GB", gender: "female", quality: "Britannique" },
  { id: "bm_george", name: "George (BBC)", language: "en-GB", gender: "male", quality: "Britannique" },
];
