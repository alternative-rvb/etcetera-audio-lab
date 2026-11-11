// SECTION: Catalogue des providers (libellés, fiches techniques, réglages par défaut).
// ANCHOR: source unique utilisée par l'UI (cartes, sélecteurs, filtres) et par les logs.

import type { LogSource, SttProviderId, TtsProviderId, TtsSettingsByProvider } from "./types";

export interface ProviderSpec {
  label: string;
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
    tagline: "100 % local CPU",
    description: "Moteur rapide et léger, entièrement local sur CPU, sans GPU ni réseau.",
    stack: "Binaire C++ natif, child_process, modèles ONNX",
    requirements: ["Hors ligne, CPU x86_64 standard", "Modèles dans voices/ (~60 Mo de RAM)"],
    license: "MIT (binaire archivé)",
    output: "WAV 22,05 kHz",
  },
  kokoro: {
    label: "Kokoro",
    tagline: "Local ONNX 82M",
    description: "Modèle neuronal compact (82M paramètres, StyleTTS2) au timbre studio, supérieur à Piper.",
    stack: "kokoro-js, onnxruntime-node (q8), espeak-ng IPA",
    requirements: ["Hors ligne, CPU moderne (AVX2)", "bin/espeak-ng pour les phonèmes français"],
    license: "Apache 2.0",
    output: "WAV 24 kHz",
  },
  chatterbox: {
    label: "Chatterbox",
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
    tagline: "Navigateur natif",
    description: "Transcription en direct intégrée au navigateur, pendant l'enregistrement micro. Aucune installation.",
    stack: "SpeechRecognition (Chrome, Edge)",
    requirements: ["Micro uniquement (pas de fichier)", "Chrome ou Edge, réseau requis"],
    license: "Natif navigateur",
  },
  whisper: {
    label: "Whisper",
    tagline: "Faster-Whisper local",
    description: "Modèle de référence : ponctuation, détection de langue et horodatage mot à mot.",
    stack: "faster-whisper, CTranslate2, FastAPI",
    requirements: ["Service Python python/ démarré (port 5002)", "CUDA ou CPU"],
    license: "MIT",
  },
  sherpa: {
    label: "Sherpa-ONNX",
    tagline: "Provisoire : Whisper tiny CPU",
    description:
      "Cible : moteur offline léger pour VPS sans GPU. En attendant le ticket 22, cette option exécute Whisper tiny sur CPU.",
    stack: "Prévu : sherpa-onnx (Next-gen Kaldi)",
    requirements: ["Service Python python/ démarré (port 5002)"],
    license: "Apache 2.0",
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
