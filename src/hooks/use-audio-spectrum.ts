"use client";

import { useEffect, useRef, type RefObject } from "react";
import { reportBrowserLog } from "@/lib/client/browser-logger";

// SECTION: Spectre de fréquences dessiné sur un canvas, alimenté par un <audio> ou un flux micro.

interface SpectrumOptions {
  color: string;
  barCount?: number;
}

function resolveCssColor(element: HTMLElement, color: string): string {
  const match = /^var\((--[^)]+)\)$/.exec(color);
  return match ? getComputedStyle(element).getPropertyValue(match[1]).trim() || "#3b82f6" : color;
}

function drawSpectrumLoop(canvas: HTMLCanvasElement, analyser: AnalyserNode, options: SpectrumOptions): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => undefined;
  const data = new Uint8Array(analyser.frequencyBinCount);
  const barCount = options.barCount ?? 48;
  let frame = 0;

  const draw = () => {
    frame = requestAnimationFrame(draw);
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth * ratio;
    const height = canvas.clientHeight * ratio;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    analyser.getByteFrequencyData(data);
    ctx.clearRect(0, 0, width, height);
    const color = resolveCssColor(canvas, options.color);
    const step = Math.floor(data.length / barCount) || 1;
    const gap = 2 * ratio;
    const barWidth = width / barCount - gap;
    for (let i = 0; i < barCount; i++) {
      const value = data[i * step] / 255;
      const barHeight = Math.max(2 * ratio, value * height);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.35 + value * 0.65;
      ctx.fillRect(i * (barWidth + gap), height - barHeight, barWidth, barHeight);
    }
    ctx.globalAlpha = 1;
  };
  draw();
  return () => cancelAnimationFrame(frame);
}

let sharedAudioContext: AudioContext | null = null;
const connectedElements = new WeakMap<HTMLMediaElement, AnalyserNode>();

function getAudioContext(): AudioContext {
  sharedAudioContext ??= new AudioContext();
  return sharedAudioContext;
}

/** Spectre d'un élément <audio> (un MediaElementSource ne peut être créé qu'une fois par élément). */
export function useMediaElementSpectrum(
  audioRef: RefObject<HTMLAudioElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  options: SpectrumOptions
) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas) return;
    let stopDrawing: (() => void) | null = null;

    const start = () => {
      try {
        const context = getAudioContext();
        if (context.state === "suspended") void context.resume();
        let analyser = connectedElements.get(audio);
        if (!analyser) {
          analyser = context.createAnalyser();
          analyser.fftSize = 256;
          const source = context.createMediaElementSource(audio);
          source.connect(analyser);
          analyser.connect(context.destination);
          connectedElements.set(audio, analyser);
        }
        stopDrawing?.();
        stopDrawing = drawSpectrumLoop(canvas, analyser, optionsRef.current);
      } catch (err) {
        reportBrowserLog("warn", "browser", "audio.spectrum_failed", "Spectre audio indisponible (AudioContext).", { error: err });
      }
    };
    const stop = () => {
      stopDrawing?.();
      stopDrawing = null;
    };
    audio.addEventListener("play", start);
    audio.addEventListener("pause", stop);
    audio.addEventListener("ended", stop);
    return () => {
      stop();
      audio.removeEventListener("play", start);
      audio.removeEventListener("pause", stop);
      audio.removeEventListener("ended", stop);
    };
  }, [audioRef, canvasRef]);
}

/** Spectre d'un flux micro (MediaStream), sans sortie vers les haut-parleurs. */
export function useMediaStreamSpectrum(
  stream: MediaStream | null,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  options: SpectrumOptions
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!stream || !canvas) return;
    const context = getAudioContext();
    if (context.state === "suspended") void context.resume();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const stop = drawSpectrumLoop(canvas, analyser, options);
    return () => {
      stop();
      source.disconnect();
    };
  }, [stream, canvasRef, options.color]);
}
