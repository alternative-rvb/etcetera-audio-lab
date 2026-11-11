"use client";

import { useEffect, useRef } from "react";

// SECTION: Détection de fin de parole sur un flux micro : niveau RMS sous un seuil pendant une durée donnée, après qu'une parole a été entendue.

export interface SilenceDetectorOptions {
  enabled: boolean;
  /** Niveau RMS (0 à 1) au-dessus duquel on considère qu'il y a de la parole. */
  threshold: number;
  /** Durée de silence continue qui déclenche onSilence, en millisecondes. */
  silenceMs: number;
  onSilence: () => void;
}

const POLL_MS = 50;

export function useSilenceDetector(stream: MediaStream | null, options: SilenceDetectorOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!stream || !options.enabled) return;
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);

    let heardSpeech = false;
    let silentSince: number | null = null;
    let fired = false;

    const timer = window.setInterval(() => {
      if (fired) return;
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      const rms = Math.sqrt(sum / samples.length);
      const { threshold, silenceMs, onSilence } = optionsRef.current;
      const now = performance.now();

      if (rms >= threshold) {
        heardSpeech = true;
        silentSince = null;
        return;
      }
      // NOTE: tant qu'aucune parole n'a été entendue, le silence initial ne coupe pas l'écoute.
      if (!heardSpeech) return;
      silentSince ??= now;
      if (now - silentSince >= silenceMs) {
        fired = true;
        onSilence();
      }
    }, POLL_MS);

    return () => {
      window.clearInterval(timer);
      source.disconnect();
      void context.close();
    };
  }, [stream, options.enabled]);
}
