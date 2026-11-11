import type { TtsVoice } from "@/lib/shared/types";

// SECTION: Voix Edge TTS retenues (voix Neural françaises).

export const EDGE_TTS_VOICES: TtsVoice[] = [
  { id: "fr-FR-DeniseNeural", name: "Denise", language: "fr-FR", gender: "female", quality: "Neural" },
  { id: "fr-FR-EloiseNeural", name: "Éloïse", language: "fr-FR", gender: "female", quality: "Neural" },
  { id: "fr-FR-VivienneMultilingualNeural", name: "Vivienne", language: "fr-FR", gender: "female", quality: "Multilingue" },
  { id: "fr-FR-HenriNeural", name: "Henri", language: "fr-FR", gender: "male", quality: "Neural" },
  { id: "fr-FR-RemyMultilingualNeural", name: "Rémy", language: "fr-FR", gender: "male", quality: "Multilingue" },
];
