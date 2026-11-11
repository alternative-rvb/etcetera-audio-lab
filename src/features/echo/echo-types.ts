import type { EngineRuntime, SttProviderId, TtsProviderId } from "@/lib/shared/types";

// SECTION: Types de la page Écho (un tour = parole, transcription, pause, synthèse, lecture).

export type EchoPhase = "idle" | "listening" | "transcribing" | "thinking" | "waiting" | "synthesizing" | "speaking";

/** "echo" : la voix répète la phrase ; "ai" : Groq formule une réponse avec le contexte de la conversation. */
export type EchoMode = "echo" | "ai";

export interface EchoSettings {
  responseMode: EchoMode;
  /** Pause insérée entre la fin de la transcription et le début de la synthèse. */
  delayMs: number;
  /** Arrêt automatique de l'écoute après un silence. */
  autoStop: boolean;
  silenceMs: number;
  /** Seuil RMS de parole (0 à 1). */
  threshold: number;
}

export const DEFAULT_ECHO_SETTINGS: EchoSettings = { responseMode: "echo", delayMs: 1000, autoStop: true, silenceMs: 1200, threshold: 0.02 };

/** Temps mesurés pendant un tour, en millisecondes (durée de parole en secondes). */
export interface EchoTimes {
  speechSec?: number;
  /** Silence attendu avant l'arrêt automatique (0 en arrêt manuel). */
  detectionMs?: number;
  /** Arrêt de l'écoute jusqu'au texte reçu (finalisation Web Speech comprise). */
  sttMs?: number;
  sttServerMs?: number;
  /** Requête de réponse IA, aller-retour client (0 en mode écho). */
  llmMs?: number;
  llmServerMs?: number;
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
  /** Phrase transcrite. */
  text: string;
  /** Mode du tour ; absent sur les tours enregistrés avant le mode IA (= "echo"). */
  mode?: EchoMode;
  /** Texte lu par la voix : la réponse IA, ou la phrase elle-même en mode écho. */
  reply?: string;
  /** Conversation IA à laquelle appartient le tour (mémoire envoyée à Groq). */
  conversationId?: string;
  llmModel?: string;
  audioUrl: string;
  times: Required<EchoTimes>;
  sttRuntime?: EngineRuntime;
  ttsRuntime?: EngineRuntime;
  fallback: boolean;
  /** Note sur 3 donnée à la réponse (0 = non noté), utilisée par la matrice de décision. */
  score: number;
}

export const MAX_ECHO_ROUNDS = 50;
/** Tours IA envoyés à Groq comme mémoire de la conversation (même limite côté serveur). */
export const ECHO_AI_MEMORY = 10;

export const roundMode = (round: Pick<EchoRound, "mode">): EchoMode => round.mode ?? "echo";
