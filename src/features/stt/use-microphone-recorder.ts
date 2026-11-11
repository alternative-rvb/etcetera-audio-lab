"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { reportBrowserLog } from "@/lib/client/browser-logger";

// SECTION: Enregistrement micro (getUserMedia + MediaRecorder), avec le flux exposé pour le spectre.

export interface RecordedAudio {
  blob: Blob;
  fileName: string;
  durationSec: number;
}

function describeMicrophoneError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") return "Accès au micro refusé. Autorisez-le dans les réglages du site puis réessayez.";
    if (err.name === "NotFoundError") return "Aucun micro détecté sur cet appareil.";
    if (err.name === "NotReadableError") return "Le micro est déjà utilisé par une autre application.";
  }
  return err instanceof Error ? err.message : String(err);
}

function pickRecorderMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return candidates.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type));
}

export function useMicrophoneRecorder(onRecorded: (audio: RecordedAudio) => void) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startedAtRef = useRef(0);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
      recorder.onerror = (event) =>
        reportBrowserLog("error", "browser", "microphone.recorder_error", "Erreur MediaRecorder pendant l'enregistrement.", { error: (event as ErrorEvent).error });
      recorder.onstop = () => {
        mediaStream.getTracks().forEach((track) => track.stop());
        setStream(null);
        const type = recorder.mimeType || "audio/webm";
        const extension = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
        const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, "-");
        // NOTE: l'ancien code étiquetait l'enregistrement en audio/wav alors que MediaRecorder produit du WebM/Opus.
        onRecordedRef.current({
          blob: new Blob(chunks, { type }),
          fileName: `enregistrement_${stamp}.${extension}`,
          durationSec: (Date.now() - startedAtRef.current) / 1000,
        });
      };
      recorder.start();
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setStream(mediaStream);
      reportBrowserLog("info", "browser", "microphone.started", "Enregistrement micro démarré.", { meta: { mimeType: recorder.mimeType } });
      return true;
    } catch (err) {
      const message = describeMicrophoneError(err);
      setError(message);
      reportBrowserLog("error", "browser", "microphone.denied", message, { error: err });
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recorderRef.current = null;
  }, []);

  // NOTE: libère le micro si l'utilisateur quitte la page pendant un enregistrement.
  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
      recorder.stream.getTracks().forEach((track) => track.stop());
    }
  }, []);

  return { start, stop, stream, recording: stream !== null, error };
}
