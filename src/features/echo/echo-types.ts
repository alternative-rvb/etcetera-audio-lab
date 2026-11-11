import type { EngineRuntime, SttProviderId, TtsProviderId } from "@/lib/shared/types";

// SECTION: Types de la page Écho (un tour = parole, transcription, pause, synthèse, lecture).

export type EchoPhase = "idle" | "listening" | "transcribing" | "waiting" | "synthesizing" | "speaking";

export interface EchoSettings {
  /** Pause insérée entre la fin de la transcription et le début de la synthèse. */
  delayMs: number;
  /** Arrêt automatique de l'écoute après un silence. */
  autoStop: boolean;
  silenceMs: number;
  /** Seuil RMS de parole (0 à 1). */
  threshold: number;
  /** Reprise de l'écoute à la fin de chaque lecture. */
  handsFree: boolean;
}

export const DEFAULT_ECHO_SETTINGS: EchoSettings = { delayMs: 1000, autoStop: true, silenceMs: 1200, threshold: 0.02, handsFree: true };

/** Temps mesurés pendant un tour, en millisecondes (durée de parole en secondes). */
export interface EchoTimes {
  speechSec?: number;
  /** Silence attendu avant l'arrêt automatique (0 en arrêt manuel). */
  detectionMs?: number;
  /** Arrêt de l'écoute jusqu'au texte reçu (finalisation Web Speech comprise). */
  sttMs?: number;
  sttServerMs?: number;
  delayMs?: number;
  /** Requête de synthèse, aller-retour client. */
  ttsMs?: number;
  ttsServerMs?: number;
  /** Fin réelle de la parole jusqu'au début de la lecture, pause comprise. */
  latencyMs?: number;
  /** Durée de lecture de la réponse. */
  playbackMs?: number;
  /** Temps total du tour : début de l'écoute jusqu'à la fin de la lecture. */
  totalMs?: number;
}

export interface EchoRound {
  id: string;
  createdAt: string;
  sttProvider: SttProviderId;
  ttsProvider: TtsProviderId;
  voiceName: string;
  text: string;
  audioUrl: string;
  times: Required<EchoTimes>;
  sttRuntime?: EngineRuntime;
  ttsRuntime?: EngineRuntime;
  fallback: boolean;
  /** Note sur 3 donnée à la réponse (0 = non noté), utilisée par la matrice de décision. */
  score: number;
}

export const MAX_ECHO_ROUNDS = 50;
