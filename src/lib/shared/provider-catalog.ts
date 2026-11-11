// SECTION: Catalogue des providers (libellés, fiches techniques, réglages par défaut).
// ANCHOR: source unique utilisée par l'UI (cartes, sélecteurs, filtres) et par les logs.

import type { LogSource, SttProviderId, TtsProviderId, TtsSettingsByProvider } from "./types";

export interface ProviderSpec {
  label: string;
  /** Où tourne le moteur, affiché en icône dans le sélecteur. */
  runtime: "cloud" | "local" | "browser";
  tagline: string;
  description: string;
  stack: string;
  requirements: string[];
  license: string;
  output?: string;
}

export const TTS_PROVIDER_CATALOG: Record<TtsProviderId, ProviderSpec> = {
  "edge-tts": {
    label: "Edge TTS",
    runtime: "cloud",
    tagline: "API cloud Microsoft",
    description:
      "Voix neurales Microsoft Edge via un endpoint gratuit, sans clé API. Moteur de référence actuellement en production dans NowWeAct.",
    stack: "msedge-tts, Node.js, WebSocket",
    requirements: ["Connexion Internet (HTTPS/WSS)", "Aucune clé API, empreinte mémoire minime"],
    license: "MIT (lib)",
    output: "MP3 24 kHz",
  },
  piper: {
    label: "Piper",
    runtime: "local",
    tagline: "100 % local CPU",
    description: "Moteur rapide et léger, entièrement local sur CPU, sans GPU ni réseau. Exécuté dans l'app, avec le binaire Piper en secours.",
    stack: "sherpa-onnx-node (VITS), espeak-ng IPA ; secours binaire C++",
    requirements: ["Hors ligne, CPU x86_64 standard", "Modèles dans models/sherpa/ et voices/ (~60 Mo de RAM)"],
    license: "MIT (voix), Apache 2.0 (sherpa-onnx)",
    output: "WAV 22,05 kHz",
  },
  kokoro: {
    label: "Kokoro",
    runtime: "local",
    tagline: "Local ONNX 82M",
    description: "Modèle neuronal compact (82M paramètres, StyleTTS2) au timbre studio, supérieur à Piper.",
    stack: "kokoro-js, onnxruntime-node (q8), espeak-ng IPA",
    requirements: ["Hors ligne, CPU moderne (AVX2)", "bin/espeak-ng pour les phonèmes français"],
    license: "Apache 2.0",
    output: "WAV 24 kHz",
  },
  chatterbox: {
    label: "Chatterbox",
    runtime: "local",
    tagline: "Clonage vocal local",
    description: "Clonage vocal zéro-shot (Resemble AI) à partir d'un échantillon audio de référence.",
    stack: "FastAPI, PyTorch, CUDA, chatterbox-tts",
    requirements: ["GPU NVIDIA recommandé (~2-3 Go de VRAM)", "Service Python python/ démarré (port 5002)"],
    license: "MIT",
    output: "WAV 24 kHz",
  },
};

export const STT_PROVIDER_CATALOG: Record<SttProviderId, ProviderSpec> = {
  "web-speech": {
    label: "Web Speech API",
    runtime: "browser",
    tagline: "Navigateur natif",
    description: "Transcription en direct intégrée au navigateur, pendant l'enregistrement micro. Aucune installation.",
    stack: "SpeechRecognition (Chrome, Edge)",
    requirements: ["Micro uniquement (pas de fichier)", "Chrome ou Edge, réseau requis"],
    license: "Natif navigateur",
  },
  whisper: {
    label: "Whisper",
    runtime: "local",
    tagline: "CPU dans l'app, GPU en Python",
    description:
      "Modèle de référence d'OpenAI : ponctuation et détection de langue. Sur CPU, exécuté dans l'app ; sur GPU, par Faster-Whisper du service Python, seul à donner l'horodatage mot à mot.",
    stack: "sherpa-onnx-node (CPU) ; faster-whisper, CTranslate2, FastAPI (CUDA et secours)",
    requirements: ["CPU : modèles dans models/sherpa/ et ffmpeg", "GPU : service Python démarré (port 5002)"],
    license: "MIT",
  },
  sherpa: {
    label: "Sherpa-ONNX",
    runtime: "local",
    tagline: "Parakeet v3 dans l'app",
    description:
      "Moteur hors ligne pour VPS sans GPU : NVIDIA Parakeet TDT 0.6B v3, 25 langues européennes, langue détectée automatiquement. Secours : Whisper tiny du service Python.",
    stack: "sherpa-onnx-node (Next-gen Kaldi), ONNX int8, VAD Silero",
    requirements: ["Hors ligne, CPU, ~1 Go de RAM", "Modèle dans models/sherpa/ et ffmpeg"],
    license: "Apache 2.0 (sherpa-onnx), CC-BY 4.0 (Parakeet)",
  },
};

export const DEFAULT_TTS_SETTINGS: TtsSettingsByProvider = {
  "edge-tts": { ratePercent: 0 },
  piper: { lengthScale: 1, noiseScale: 0.667, noiseW: 0.8 },
  kokoro: { speed: 1 },
  chatterbox: { device: "cpu", exaggeration: 0.5, temperature: 0.8 },
};

export const LOG_SOURCE_LABELS: Record<LogSource, string> = {
  "edge-tts": "Edge TTS",
  piper: "Piper",
  kokoro: "Kokoro",
  chatterbox: "Chatterbox",
  "web-speech": "Web Speech",
  whisper: "Whisper",
  sherpa: "Sherpa",
  api: "API",
  "python-service": "Service Python",
  system: "Système",
  browser: "Navigateur",
};

/** Variable CSS de couleur associée à chaque provider (définie dans globals.css). */
export function providerColorVar(provider: TtsProviderId | SttProviderId | LogSource): string {
  return `var(--color-${provider})`;
}
