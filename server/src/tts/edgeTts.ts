import { EdgeTTS } from "edge-tts-universal";

export interface EdgeVoiceInfo {
  id: string;
  name: string;
  language: string;
  gender: "female" | "male";
  quality: string;
}

export const EDGE_VOICES: EdgeVoiceInfo[] = [
  { id: "fr-FR-DeniseNeural", name: "Denise", language: "fr-FR", gender: "female", quality: "Neural" },
  { id: "fr-FR-EloiseNeural", name: "Éloïse", language: "fr-FR", gender: "female", quality: "Neural" },
  { id: "fr-FR-VivienneMultilingualNeural", name: "Vivienne", language: "fr-FR", gender: "female", quality: "Multilingue" },
  { id: "fr-FR-HenriNeural", name: "Henri", language: "fr-FR", gender: "male", quality: "Neural" },
  { id: "fr-FR-RemyMultilingualNeural", name: "Rémy", language: "fr-FR", gender: "male", quality: "Multilingue" },
];

export function listEdgeVoices(locale?: string): EdgeVoiceInfo[] {
  if (locale) {
    const norm = locale.toLowerCase().replace("_", "-");
    return EDGE_VOICES.filter((v) => v.language.toLowerCase().replace("_", "-") === norm);
  }
  return EDGE_VOICES;
}

export interface EdgeSynthesizeOptions {
  ratePercent?: number;
}

export async function synthesizeEdge(
  text: string,
  voiceId: string,
  options: EdgeSynthesizeOptions = {}
): Promise<Buffer> {
  if (!EDGE_VOICES.some((v) => v.id === voiceId)) {
    throw new Error(`Voix Edge TTS inconnue : ${voiceId}`);
  }

  const rate = options.ratePercent !== undefined ? `${options.ratePercent >= 0 ? "+" : ""}${options.ratePercent}%` : undefined;

  const tts = new EdgeTTS(text, voiceId, rate ? { rate } : undefined);
  const { audio } = await tts.synthesize();
  return Buffer.from(await audio.arrayBuffer());
}
