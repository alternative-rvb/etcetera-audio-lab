import { KokoroTTS } from "kokoro-js";

export interface KokoroVoiceInfo {
  id: string;
  name: string;
  language: string;
  gender: "female" | "male" | "unknown";
  quality: string;
}

export const KOKORO_VOICES: KokoroVoiceInfo[] = [
  { id: "ff_siwis", name: "Siwis (France)", language: "fr-FR", gender: "female", quality: "ONNX 82M" },
  { id: "af_heart", name: "Heart (Studio A)", language: "en-US", gender: "female", quality: "Qualité A" },
  { id: "af_bella", name: "Bella (Expressive)", language: "en-US", gender: "female", quality: "Dynamique" },
  { id: "af_nicole", name: "Nicole (Podcast)", language: "en-US", gender: "female", quality: "Narratrice" },
  { id: "am_adam", name: "Adam (Posé)", language: "en-US", gender: "male", quality: "Grave" },
  { id: "am_michael", name: "Michael (Calme)", language: "en-US", gender: "male", quality: "Posé" },
  { id: "bf_emma", name: "Emma (Oxford)", language: "en-GB", gender: "female", quality: "Britannique" },
  { id: "bm_george", name: "George (BBC)", language: "en-GB", gender: "male", quality: "Britannique" },
];

let ttsInstance: any = null;
let initPromise: Promise<any> | null = null;

async function getKokoroInstance() {
  if (ttsInstance) return ttsInstance;
  if (!initPromise) {
    initPromise = (async () => {
      console.log("[Kokoro] Chargement du modèle Kokoro-82M ONNX (q8)...");
      const instance = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
        dtype: "q8",
      });
      // Permettre l'utilisation de voix personnalisées ou multilingues (comme ff_siwis)
      (instance as any)._validate_voice = (v: string) => v.at(0);
      console.log("[Kokoro] Modèle chargé avec succès !");
      ttsInstance = instance;
      return instance;
    })();
  }
  return initPromise;
}

export async function synthesizeKokoro(
  text: string,
  voiceId: string,
  options: { speed?: number } = {}
): Promise<Buffer> {
  const tts = await getKokoroInstance();
  const speed = options.speed ?? 1.0;
  const targetVoice = KOKORO_VOICES.some((v) => v.id === voiceId) ? voiceId : "ff_siwis";

  const audio = await tts.generate(text, {
    voice: targetVoice,
    speed,
  });

  const wavArrayBuffer = audio.toWav();
  return Buffer.from(wavArrayBuffer);
}

export function getKokoroVoices(locale?: string): KokoroVoiceInfo[] {
  if (locale && (locale.startsWith("fr") || locale === "fr-FR")) {
    return KOKORO_VOICES.filter((v) => v.language.startsWith("fr"));
  }
  return KOKORO_VOICES;
}

export function getKokoroVoice(voiceId: string): KokoroVoiceInfo | undefined {
  return KOKORO_VOICES.find((v) => v.id === voiceId);
}
