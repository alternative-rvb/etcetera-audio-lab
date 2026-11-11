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

type StopReason = "user" | "track-ended" | "recorder-error" | "unmount";

export function useMicrophoneRecorder(onRecorded: (audio: RecordedAudio) => void) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startedAtRef = useRef(0);
  const startingRef = useRef(false);
  const stopReasonRef = useRef<StopReason>("user");
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  const start = useCallback(async (): Promise<boolean> => {
    // NOTE: un double clic ne doit pas ouvrir deux enregistreurs, le premier resterait orphelin et le micro allumé.
    if (startingRef.current || recorderRef.current) return false;
    startingRef.current = true;
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      stopReasonRef.current = "user";
      recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
      const halt = (reason: StopReason, message?: string) => {
        if (recorderRef.current !== recorder) return;
        stopReasonRef.current = reason;
        if (message) setError(message);
        if (recorder.state !== "inactive") recorder.stop();
      };
      recorder.onerror = (event) => {
        reportBrowserLog("error", "browser", "microphone.recorder_error", "Erreur MediaRecorder pendant l'enregistrement.", { error: (event as ErrorEvent).error });
        // NOTE: sans cela, l'interface resterait bloquée en « enregistrement » alors que le micro est coupé.
        halt("recorder-error", "L'enregistrement s'est interrompu de façon inattendue.");
      };
      // NOTE: micro débranché ou accès retiré en cours de route : la piste se termine seule.
      mediaStream.getAudioTracks().forEach((track) => {
        track.onended = () => halt("track-ended", "Le micro s'est arrêté (périphérique débranché, accès retiré ou micro pris par une autre application).");
      });
      recorder.onstop = () => {
        mediaStream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        setStream(null);
        const durationSec = (Date.now() - startedAtRef.current) / 1000;
        const reason = stopReasonRef.current;
        // ANCHOR: trace de la cause de chaque arrêt, pour distinguer un arrêt voulu d'une coupure subie.
        reportBrowserLog(reason === "user" ? "info" : "warn", "browser", "microphone.stopped", `Enregistrement micro arrêté (${reason}, ${durationSec.toFixed(1)} s).`, {
          meta: { reason, durationSec: Number(durationSec.toFixed(2)), bytes: chunks.reduce((sum, chunk) => sum + chunk.size, 0) },
        });
        if (reason === "unmount") return;
        const type = recorder.mimeType || "audio/webm";
        const extension = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
        const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, "-");
        // NOTE: l'ancien code étiquetait l'enregistrement en audio/wav alors que MediaRecorder produit du WebM/Opus.
        onRecordedRef.current({ blob: new Blob(chunks, { type }), fileName: `enregistrement_${stamp}.${extension}`, durationSec });
      };
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setStream(mediaStream);
      reportBrowserLog("info", "browser", "microphone.started", "Enregistrement micro démarré.", { meta: { mimeType: recorder.mimeType } });
      return true;
    } catch (err) {
      const message = describeMicrophoneError(err);
      setError(message);
      reportBrowserLog("error", "browser", "microphone.denied", message, { error: err });
      return false;
    } finally {
      startingRef.current = false;
    }
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    stopReasonRef.current = "user";
    if (recorder.state !== "inactive") recorder.stop();
  }, []);

  // NOTE: libère le micro si l'utilisateur quitte la page pendant un enregistrement (ou si le composant est remonté).
  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        stopReasonRef.current = "unmount";
        recorder.stop();
      }
    },
    []
  );

  return { start, stop, stream, recording: stream !== null, error };
}
