"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { reportBrowserLog } from "@/lib/client/browser-logger";

// SECTION: Transcription en direct avec la Web Speech API du navigateur (Chrome, Edge).

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort?(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const WEB_SPEECH_ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Reconnaissance vocale refusée par le navigateur.",
  "no-speech": "Aucune parole détectée.",
  network: "Le service de reconnaissance du navigateur est injoignable (réseau requis).",
  "audio-capture": "Micro indisponible pour la reconnaissance vocale.",
  "language-not-supported": "Langue non prise en charge par le navigateur.",
};

/** Erreurs après lesquelles relancer l'écoute ne sert à rien. */
const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported", "network"]);

export function useWebSpeechRecognition() {
  const [supported, setSupported] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  /** Texte validé par les sessions d'écoute déjà terminées (Chrome en coupe une après quelques secondes de silence). */
  const committedRef = useRef("");
  const sessionFinalRef = useRef("");
  const listeningRef = useRef(false);
  const fatalRef = useRef(false);
  const languageRef = useRef("fr-FR");

  useEffect(() => setSupported(getSpeechRecognitionConstructor() !== null), []);

  const publish = useCallback((interim: string) => {
    const text = `${committedRef.current} ${sessionFinalRef.current} ${interim}`.replace(/\s+/g, " ").trim();
    transcriptRef.current = text;
    setTranscript(text);
  }, []);

  const launch = useCallback(() => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) return;
    const language = languageRef.current;
    sessionFinalRef.current = "";
    try {
      const recognition = new Recognition();
      recognition.lang = language;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let finalText = "";
        let interimText = "";
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalText += result[0].transcript;
          else interimText += result[0].transcript;
        }
        sessionFinalRef.current = finalText;
        publish(interimText);
      };
      recognition.onerror = (event) => {
        // NOTE: "aborted" survient à chaque arrêt volontaire, ce n'est pas une erreur.
        if (event.error === "aborted") return;
        // NOTE: "no-speech" ne fait que terminer la session, onend relance l'écoute tant que l'enregistrement dure.
        if (FATAL_ERRORS.has(event.error)) fatalRef.current = true;
        const message = WEB_SPEECH_ERROR_MESSAGES[event.error] ?? `Erreur Web Speech : ${event.error}`;
        if (event.error !== "no-speech") setError(message);
        reportBrowserLog(event.error === "no-speech" ? "warn" : "error", "web-speech", `recognition.${event.error}`, message, { meta: { language } });
      };
      // ANCHOR: coupure intempestive : le navigateur arrête la session seul, on valide le texte et on relance.
      recognition.onend = () => {
        if (recognitionRef.current !== recognition) return;
        committedRef.current = `${committedRef.current} ${sessionFinalRef.current}`.trim();
        sessionFinalRef.current = "";
        recognitionRef.current = null;
        if (!listeningRef.current || fatalRef.current) return;
        launch();
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      recognitionRef.current = null;
      listeningRef.current = false;
      setError("Impossible de démarrer la reconnaissance vocale.");
      reportBrowserLog("error", "web-speech", "recognition.start_failed", "Impossible de démarrer la reconnaissance vocale.", { error: err });
    }
  }, [publish]);

  const start = useCallback(
    (language: string) => {
      setTranscript("");
      transcriptRef.current = "";
      committedRef.current = "";
      sessionFinalRef.current = "";
      fatalRef.current = false;
      languageRef.current = language;
      setError(null);
      if (!getSpeechRecognitionConstructor()) return;
      listeningRef.current = true;
      launch();
      reportBrowserLog("info", "web-speech", "recognition.started", "Reconnaissance vocale démarrée.", { meta: { language } });
    },
    [launch]
  );

  /** Arrête la reconnaissance et renvoie le texte final (les derniers résultats arrivent juste après stop()). */
  const stop = useCallback(
    () =>
      new Promise<string>((resolve) => {
        listeningRef.current = false;
        const recognition = recognitionRef.current;
        if (!recognition) return resolve(transcriptRef.current);
        const timer = setTimeout(() => resolve(transcriptRef.current), 1200);
        const previousOnEnd = recognition.onend;
        recognition.onend = () => {
          clearTimeout(timer);
          previousOnEnd?.();
          resolve(transcriptRef.current);
        };
        try {
          recognition.stop();
        } catch {
          clearTimeout(timer);
          resolve(transcriptRef.current);
        }
      }),
    []
  );

  /** Oublie le texte et l'erreur de la session précédente (changement de moteur, nouvel audio). */
  const reset = useCallback(() => {
    listeningRef.current = false;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      try {
        recognition.abort?.();
      } catch {
        // NOTE: déjà arrêtée, rien à faire.
      }
    }
    committedRef.current = "";
    sessionFinalRef.current = "";
    transcriptRef.current = "";
    fatalRef.current = false;
    setTranscript("");
    setError(null);
  }, []);

  useEffect(
    () => () => {
      listeningRef.current = false;
      recognitionRef.current?.stop();
    },
    []
  );

  return { supported, transcript, error, start, stop, reset };
}
