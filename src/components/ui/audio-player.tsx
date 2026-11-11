"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { reportBrowserLog } from "@/lib/client/browser-logger";
import { cn } from "@/lib/client/cn";
import { IconLink } from "./button";
import { Icon } from "./icon";
import { Tooltip } from "./tooltip";

// SECTION: Lecteur audio maison : forme d'onde aux couleurs du moteur qui sert de barre de progression.
// ANCHOR: la couleur vient de la variable CSS --provider posée par un parent (providerStyle).

export interface AudioPlayerHandle {
  seek: (seconds: number) => void;
}

const PLAYBACK_RATES = [1, 1.25, 1.5, 0.75] as const;
const PEAK_COUNT = 240;
const MAX_DECODE_BYTES = 30 * 1024 * 1024;
const PLAY_EVENT = "etcetera-audio-play";

// SECTION: Calcul des pics de la forme d'onde, une fois par URL.

const peaksCache = new Map<string, Promise<number[] | null>>();

async function computePeaks(src: string): Promise<number[] | null> {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_DECODE_BYTES) return null;
    const audio = await new OfflineAudioContext(1, 1, 22050).decodeAudioData(buffer);
    const data = audio.getChannelData(0);
    const block = Math.max(1, Math.floor(data.length / PEAK_COUNT));
    const peaks: number[] = [];
    for (let i = 0; i < PEAK_COUNT; i++) {
      let max = 0;
      for (let j = i * block; j < Math.min((i + 1) * block, data.length); j++) max = Math.max(max, Math.abs(data[j]));
      peaks.push(max);
    }
    const top = Math.max(...peaks) || 1;
    return peaks.map((p) => p / top);
  } catch (err) {
    reportBrowserLog("warn", "browser", "audio.waveform_failed", "Forme d'onde indisponible pour cet audio.", { error: err, meta: { src } });
    return null;
  }
}

function useWaveformPeaks(src: string | null): number[] | null {
  const [peaks, setPeaks] = useState<{ src: string; values: number[] | null } | null>(null);
  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    if (!peaksCache.has(src)) peaksCache.set(src, computePeaks(src));
    void peaksCache.get(src)!.then((values) => !cancelled && setPeaks({ src, values }));
    return () => {
      cancelled = true;
    };
  }, [src]);
  return peaks?.src === src ? peaks.values : null;
}

// SECTION: Dessin de la forme d'onde (partie lue en couleur du moteur).

function drawWaveform(canvas: HTMLCanvasElement, peaks: number[] | null, progress: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);
  if (!width || !height) return;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const styles = getComputedStyle(canvas);
  const played = styles.getPropertyValue("--provider").trim() || styles.getPropertyValue("--accent").trim();
  const rest = styles.getPropertyValue("--border-strong").trim();
  const barWidth = 2 * ratio;
  const gap = 1.5 * ratio;
  const count = Math.max(1, Math.floor(width / (barWidth + gap)));
  ctx.clearRect(0, 0, width, height);
  for (let i = 0; i < count; i++) {
    let value = 0.18;
    if (peaks) {
      const from = Math.floor((i / count) * peaks.length);
      const to = Math.max(from + 1, Math.floor(((i + 1) / count) * peaks.length));
      value = Math.max(...peaks.slice(from, to));
    }
    const barHeight = Math.max(2 * ratio, value * height * 0.92);
    ctx.fillStyle = i / count < progress ? played : rest;
    ctx.fillRect(i * (barWidth + gap), (height - barHeight) / 2, barWidth, barHeight);
  }
}

function formatClockTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function formatRate(rate: number): string {
  return `${String(rate).replace(".", ",")}×`;
}

export function AudioPlayer({
  src,
  downloadName,
  autoPlayToken = 0,
  onTimeUpdate,
  onDurationChange,
  handleRef,
  compact = false,
  className,
}: {
  src: string;
  /** Nom proposé au téléchargement ; sans nom, pas de bouton de téléchargement. */
  downloadName?: string;
  /** Change à chaque demande explicite de lecture (nouvelle génération, clic dans l'historique). */
  autoPlayToken?: number;
  onTimeUpdate?: (seconds: number) => void;
  /** Durée réelle de l'audio, connue une fois les métadonnées chargées. */
  onDurationChange?: (seconds: number) => void;
  handleRef?: RefObject<AudioPlayerHandle | null>;
  compact?: boolean;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState<number>(1);
  const peaks = useWaveformPeaks(src);

  const redraw = useCallback(() => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas) return;
    const total = audio.duration;
    drawWaveform(canvas, peaks, Number.isFinite(total) && total > 0 ? audio.currentTime / total : 0);
  }, [peaks]);

  const seek = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const total = Number.isFinite(audio.duration) ? audio.duration : seconds;
      audio.currentTime = Math.min(Math.max(0, seconds), total);
      setCurrentTime(audio.currentTime);
      redraw();
    },
    [redraw]
  );

  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      seek: (seconds) => {
        seek(seconds);
        void audioRef.current?.play().catch(() => undefined);
      },
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef, seek]);

  // NOTE: nouvelle source : remise à zéro de l'affichage.
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
  }, [rate, src]);

  useEffect(() => {
    if (autoPlayToken === 0) return;
    void audioRef.current?.play().catch(() => undefined);
  }, [autoPlayToken]);

  // ANCHOR: un seul lecteur à la fois : démarrer celui-ci met les autres en pause.
  useEffect(() => {
    const onOtherPlay = (event: Event) => {
      if ((event as CustomEvent<HTMLAudioElement>).detail !== audioRef.current) audioRef.current?.pause();
    };
    window.addEventListener(PLAY_EVENT, onOtherPlay);
    return () => window.removeEventListener(PLAY_EVENT, onOtherPlay);
  }, []);

  // NOTE: animation fluide de la progression pendant la lecture (timeupdate ne tombe que 4 fois par seconde).
  useEffect(() => {
    if (!playing) {
      redraw();
      return;
    }
    let frame = 0;
    const loop = () => {
      redraw();
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frame);
  }, [playing, redraw]);

  // NOTE: redessin au redimensionnement et au changement de thème (couleurs relues dans les variables CSS).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resizeObserver = new ResizeObserver(redraw);
    resizeObserver.observe(canvas);
    const themeObserver = new MutationObserver(redraw);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      resizeObserver.disconnect();
      themeObserver.disconnect();
    };
  }, [redraw]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  };

  const seekFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const total = audioRef.current?.duration;
    if (!total || !Number.isFinite(total)) return;
    seek(((event.clientX - rect.left) / rect.width) * total);
  };

  const onTrackKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const moves: Record<string, number> = { ArrowLeft: -5, ArrowRight: 5, ArrowDown: -5, ArrowUp: 5 };
    if (event.key in moves) seek(audio.currentTime + moves[event.key]);
    else if (event.key === "Home") seek(0);
    else if (event.key === "End") seek(audio.duration);
    else if (event.key === " " || event.key === "Enter") togglePlay();
    else return;
    event.preventDefault();
  };

  const nextRate = PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(rate as (typeof PLAYBACK_RATES)[number]) + 1) % PLAYBACK_RATES.length];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={(event) => {
          setPlaying(true);
          window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: event.currentTarget }));
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onDurationChange={(event) => {
          const total = event.currentTarget.duration;
          setDuration(total);
          if (Number.isFinite(total) && total > 0) onDurationChange?.(total);
        }}
        onTimeUpdate={(event) => {
          setCurrentTime(event.currentTarget.currentTime);
          onTimeUpdate?.(event.currentTarget.currentTime);
        }}
      />

      <button
        type="button"
        aria-label={playing ? "Mettre en pause" : "Lire"}
        onClick={togglePlay}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--provider,var(--accent))] text-white shadow-sm transition hover:brightness-110 retro:text-[#040914] retro:shadow-[0_0_14px_var(--provider,var(--accent))]",
          compact ? "size-8" : "size-10"
        )}
      >
        <Icon name={playing ? "pause" : "play"} size={compact ? 20 : 24} />
      </button>

      <div
        role="slider"
        tabIndex={0}
        aria-label="Position de lecture"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration) || 0}
        aria-valuenow={Math.round(currentTime)}
        aria-valuetext={`${formatClockTime(currentTime)} sur ${formatClockTime(duration)}`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          seekFromPointer(event);
        }}
        onPointerMove={(event) => event.currentTarget.hasPointerCapture(event.pointerId) && seekFromPointer(event)}
        onKeyDown={onTrackKeyDown}
        className={cn("relative min-w-0 flex-1 cursor-pointer touch-none rounded-md", compact ? "h-7" : "h-10")}
      >
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full" />
      </div>

      <span className="shrink-0 text-xs whitespace-nowrap text-muted tabular-nums">
        {formatClockTime(currentTime)} / {formatClockTime(duration)}
      </span>

      <Tooltip label={`Vitesse de lecture, passer à ${formatRate(nextRate)}`}>
        <button
          type="button"
          aria-label={`Vitesse de lecture ${formatRate(rate)}, passer à ${formatRate(nextRate)}`}
          onClick={() => setRate(nextRate)}
          className={cn(
            "inline-flex h-7 min-w-10 shrink-0 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums transition hover:bg-sunken",
            rate === 1 ? "text-muted" : "text-[var(--provider,var(--accent))]"
          )}
        >
          {formatRate(rate)}
        </button>
      </Tooltip>

      {downloadName && (
        <IconLink label="Télécharger l'audio" href={src} download={downloadName}>
          <Icon name="download" />
        </IconLink>
      )}
    </div>
  );
}
