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

export function useWebSpeechRecognition() {
  const [supported, setSupported] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");

  useEffect(() => setSupported(getSpeechRecognitionConstructor() !== null), []);

  const start = useCallback((language: string) => {
    const Recognition = getSpeechRecognitionConstructor();
    setTranscript("");
    transcriptRef.current = "";
    setError(null);
    if (!Recognition) return;
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
        const text = `${finalText} ${interimText}`.replace(/\s+/g, " ").trim();
        transcriptRef.current = text;
        setTranscript(text);
      };
      recognition.onerror = (event) => {
        // NOTE: "aborted" survient à chaque arrêt volontaire, ce n'est pas une erreur.
        if (event.error === "aborted") return;
        const message = WEB_SPEECH_ERROR_MESSAGES[event.error] ?? `Erreur Web Speech : ${event.error}`;
        setError(message);
        reportBrowserLog(event.error === "no-speech" ? "warn" : "error", "web-speech", `recognition.${event.error}`, message, { meta: { language } });
      };
      recognition.start();
      recognitionRef.current = recognition;
      reportBrowserLog("info", "web-speech", "recognition.started", "Reconnaissance vocale démarrée.", { meta: { language } });
    } catch (err) {
      setError("Impossible de démarrer la reconnaissance vocale.");
      reportBrowserLog("error", "web-speech", "recognition.start_failed", "Impossible de démarrer la reconnaissance vocale.", { error: err });
    }
  }, []);

  /** Arrête la reconnaissance et renvoie le texte final (les derniers résultats arrivent juste après stop()). */
  const stop = useCallback(
    () =>
      new Promise<string>((resolve) => {
        const recognition = recognitionRef.current;
        recognitionRef.current = null;
        if (!recognition) return resolve(transcriptRef.current);
        const timer = setTimeout(() => resolve(transcriptRef.current), 1200);
        recognition.onend = () => {
          clearTimeout(timer);
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

  useEffect(() => () => recognitionRef.current?.stop(), []);

  return { supported, transcript, error, start, stop };
}
