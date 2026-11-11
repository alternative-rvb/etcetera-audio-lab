"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { SttHistoryEntry, SttProviderId, TtsHistoryEntry, TtsProviderId, TtsSettingsByProvider } from "@/lib/shared/types";
import { ApiClientError, apiRequest, createClientRequestId, showErrorToast } from "@/lib/client/api-client";
import { reportBrowserLog } from "@/lib/client/browser-logger";
import { buildSttFormFields, type SttSettingsByProvider } from "@/features/stt/stt-settings";
import { useMicrophoneRecorder, type RecordedAudio } from "@/features/stt/use-microphone-recorder";
import { useWebSpeechRecognition } from "@/features/stt/use-web-speech-recognition";
import type { EchoPhase, EchoRound, EchoSettings, EchoTimes } from "./echo-types";
import { useSilenceDetector } from "./use-silence-detector";

// SECTION: Cycle de l'écho : écoute, transcription, pause, synthèse, lecture. Un démarrage = un tour mesuré.
// NOTE: le micro est coupé pendant la lecture, sinon la voix de synthèse serait retranscrite en boucle.

export interface EchoConfig {
  sttProvider: SttProviderId;
  sttSettings: SttSettingsByProvider;
  ttsProvider: TtsProviderId;
  ttsSettings: TtsSettingsByProvider;
  voiceId: string | null;
  voiceName: string;
  settings: EchoSettings;
}

/** Tour en cours, affiché étape par étape. */
export interface LiveRound {
  sttProvider: SttProviderId;
  ttsProvider: TtsProviderId;
  text: string;
  times: EchoTimes;
}

/** Fin de tour sans erreur moteur (aucune parole reconnue) : on informe et on réécoute. */
class EchoSkip extends Error {}

/** Écoute coupée d'office au-delà de cette durée, pour ne pas laisser le micro ouvert indéfiniment. */
const MAX_LISTEN_MS = 60_000;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

export function useEchoLoop(config: EchoConfig, onRound: (round: EchoRound) => void) {
  const [phase, setPhase] = useState<EchoPhase>("idle");
  const [live, setLive] = useState<LiveRound | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const webSpeech = useWebSpeechRecognition();

  const configRef = useRef(config);
  configRef.current = config;
  const onRoundRef = useRef(onRound);
  onRoundRef.current = onRound;

  /** Incrémenté à chaque annulation : une étape asynchrone d'une session périmée s'arrête d'elle-même. */
  const sessionRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ignoreRecordingRef = useRef(false);
  const stopRequestedAtRef = useRef(0);
  const detectionMsRef = useRef(0);
  const listenStartedAtRef = useRef(0);
  const processRef = useRef<(recorded: RecordedAudio) => void>(() => {});

  const recorder = useMicrophoneRecorder((recorded) => processRef.current(recorded));

  const listen = useCallback(async () => {
    const session = sessionRef.current;
    const cfg = configRef.current;
    setLive({ sttProvider: cfg.sttProvider, ttsProvider: cfg.ttsProvider, text: "", times: {} });
    const started = await recorder.start();
    if (!started) {
      setPhase("idle");
      return;
    }
    // NOTE: annulé pendant l'ouverture du micro : on le referme sans traiter l'enregistrement.
    if (session !== sessionRef.current) {
      ignoreRecordingRef.current = true;
      recorder.stop();
      return;
    }
    if (cfg.sttProvider === "web-speech") webSpeech.start(cfg.sttSettings["web-speech"].language);
    listenStartedAtRef.current = performance.now();
    setPhase("listening");
  }, [recorder, webSpeech]);

  /** Fin de parole : manuelle (bouton) ou détectée après `silenceMs` de silence. */
  const finishSpeaking = useCallback(
    (detectionMs = 0) => {
      if (!recorder.recording) return;
      stopRequestedAtRef.current = performance.now();
      detectionMsRef.current = detectionMs;
      recorder.stop();
    },
    [recorder]
  );

  const playAudio = (url: string, signal: AbortSignal, onPlaying: () => void) =>
    new Promise<void>((resolve, reject) => {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.addEventListener("playing", onPlaying, { once: true });
      audio.addEventListener("ended", () => resolve(), { once: true });
      audio.addEventListener("error", () => reject(new Error("Lecture de l'audio généré impossible.")), { once: true });
      signal.addEventListener("abort", () => {
        audio.pause();
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
      audio.play().catch(reject);
    });

  processRef.current = async (recorded: RecordedAudio) => {
    if (ignoreRecordingRef.current) {
      ignoreRecordingRef.current = false;
      return;
    }
    const session = sessionRef.current;
    const cfg = configRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const stoppedAt = stopRequestedAtRef.current || performance.now();
    const detectionMs = detectionMsRef.current;
    // ANCHOR: fin réelle de la parole = arrêt de l'écoute moins le silence attendu par la détection automatique.
    const speechEndedAt = stoppedAt - detectionMs;
    stopRequestedAtRef.current = 0;
    const times: EchoTimes = { speechSec: Math.max(0, recorded.durationSec - detectionMs / 1000), detectionMs };
    const update = (patch: Partial<LiveRound>) => setLive((current) => (current ? { ...current, ...patch, times: { ...times } } : current));
    const stale = () => session !== sessionRef.current || controller.signal.aborted;

    setPhase("transcribing");
    update({});
    try {
      if (!cfg.voiceId) throw new Error("Aucune voix TTS sélectionnée.");

      // SECTION: transcription
      const browserTranscript = cfg.sttProvider === "web-speech" ? await webSpeech.stop() : undefined;
      if (cfg.sttProvider === "web-speech" && !browserTranscript?.trim()) throw new EchoSkip("Aucune parole reconnue par Web Speech.");
      const sttRequestId = createClientRequestId();
      setActiveRequestId(sttRequestId);
      const form = new FormData();
      for (const [key, value] of Object.entries(buildSttFormFields(cfg.sttProvider, cfg.sttSettings))) form.append(key, value);
      form.append("file", recorded.blob, recorded.fileName);
      if (cfg.sttProvider === "web-speech") {
        form.append("browserTranscript", browserTranscript ?? "");
        form.append("browserDurationSec", String(recorded.durationSec));
      }
      const { entry: stt } = await apiRequest<{ entry: SttHistoryEntry }>("/api/stt/transcribe", {
        method: "POST",
        body: form,
        signal: controller.signal,
        headers: { "X-Request-Id": sttRequestId },
      });
      times.sttMs = performance.now() - stoppedAt;
      times.sttServerMs = stt.processingTimeMs;
      if (stale()) return;
      const text = stt.text.trim();
      if (!text) throw new EchoSkip("Aucune parole reconnue.");
      update({ text });

      // SECTION: pause avant la réponse
      setPhase("waiting");
      await sleep(cfg.settings.delayMs, controller.signal);
      times.delayMs = cfg.settings.delayMs;
      update({});

      // SECTION: synthèse
      setPhase("synthesizing");
      const ttsRequestId = createClientRequestId();
      setActiveRequestId(ttsRequestId);
      const ttsStartedAt = performance.now();
      const { entry: tts } = await apiRequest<{ entry: TtsHistoryEntry }>("/api/tts", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({ provider: cfg.ttsProvider, text, voiceId: cfg.voiceId, settings: cfg.ttsSettings[cfg.ttsProvider] }),
        headers: { "Content-Type": "application/json", "X-Request-Id": ttsRequestId },
      });
      times.ttsMs = performance.now() - ttsStartedAt;
      times.ttsServerMs = tts.generationTimeMs;
      if (stale()) return;
      update({});

      // SECTION: lecture ; le tour est enregistré à la fin de la lecture, quand le temps total est connu.
      setPhase("speaking");
      let playingAt = 0;
      await playAudio(tts.url, controller.signal, () => {
        playingAt = performance.now();
        times.latencyMs = playingAt - speechEndedAt;
        update({});
      });
      if (stale()) return;
      const endedAt = performance.now();
      times.playbackMs = endedAt - (playingAt || endedAt);
      times.totalMs = endedAt - (listenStartedAtRef.current || speechEndedAt);
      update({});
      const round: EchoRound = {
        id: `echo_${Date.now().toString(36)}`,
        createdAt: new Date().toISOString(),
        sttProvider: cfg.sttProvider,
        ttsProvider: cfg.ttsProvider,
        voiceName: cfg.voiceName,
        text,
        audioUrl: tts.url,
        times: times as Required<EchoTimes>,
        sttRuntime: stt.runtime,
        ttsRuntime: tts.runtime,
        fallback: Boolean(stt.fallback || tts.fallback),
        score: 0,
      };
      onRoundRef.current(round);
      reportBrowserLog(
        "info",
        "browser",
        "echo.round",
        `Tour d'écho ${cfg.sttProvider} + ${cfg.ttsProvider} : latence perçue ${Math.round(times.latencyMs ?? 0)} ms, temps total ${Math.round(times.totalMs)} ms.`,
        { meta: { ...times, sttProvider: cfg.sttProvider, ttsProvider: cfg.ttsProvider } }
      );
      setPhase("idle");
    } catch (err) {
      if (stale() || (err instanceof ApiClientError && err.code === "ABORTED")) return;
      if (err instanceof EchoSkip) {
        toast.info(err.message, { description: "Parlez plus près du micro ou baissez le seuil de parole.", id: "echo-skip" });
        setPhase("idle");
        return;
      }
      showErrorToast(err, "Écho interrompu");
      setPhase("idle");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const start = useCallback(() => {
    if (phase !== "idle") return;
    void listen();
  }, [phase, listen]);

  const cancel = useCallback(() => {
    sessionRef.current += 1;
    abortRef.current?.abort();
    audioRef.current?.pause();
    if (recorder.recording) {
      ignoreRecordingRef.current = true;
      recorder.stop();
    }
    webSpeech.reset();
    setPhase("idle");
  }, [recorder, webSpeech]);

  useSilenceDetector(recorder.stream, {
    enabled: phase === "listening" && config.settings.autoStop,
    threshold: config.settings.threshold,
    silenceMs: config.settings.silenceMs,
    onSilence: () => finishSpeaking(configRef.current.settings.silenceMs),
  });

  useEffect(() => {
    if (phase !== "listening") return;
    const timer = window.setTimeout(() => finishSpeaking(), MAX_LISTEN_MS);
    return () => window.clearTimeout(timer);
  }, [phase, finishSpeaking]);

  // NOTE: Échap arrête l'écho à tout moment.
  useEffect(() => {
    if (phase === "idle") return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && cancel();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, cancel]);

  // NOTE: quitter la page coupe la lecture et les requêtes en cours.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      audioRef.current?.pause();
    },
    []
  );

  return {
    phase,
    live,
    activeRequestId,
    stream: recorder.stream,
    micError: recorder.error,
    liveTranscript: webSpeech.transcript,
    webSpeechSupported: webSpeech.supported,
    start,
    finishSpeaking: () => finishSpeaking(),
    cancel,
  };
}
