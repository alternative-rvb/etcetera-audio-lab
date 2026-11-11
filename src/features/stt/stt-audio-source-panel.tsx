"use client";

import { useRef, useState, type DragEvent } from "react";
import type { SttProviderId } from "@/lib/shared/types";
import { providerColorVar } from "@/lib/shared/provider-catalog";
import { AudioPlayer } from "@/components/ui/audio-player";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { useMediaStreamSpectrum } from "@/hooks/use-audio-spectrum";
import { useElapsedTime } from "@/hooks/use-elapsed-time";
import { reportBrowserLog } from "@/lib/client/browser-logger";
import { formatBytes, formatTimer } from "@/lib/client/format";
import { cn } from "@/lib/client/cn";

// SECTION: Source audio à transcrire : micro (spectre et texte Web Speech pendant l'enregistrement), fichier importé, échantillon de démo.
// NOTE: les boutons Enregistrer, Arrêter et Transcrire sont dans la barre d'action du workbench, un seul bouton principal à la fois.

export const MAX_STT_UPLOAD_BYTES = 50 * 1024 * 1024;

export type SttAudioOrigin = "mic" | "upload" | "demo";

export interface SttAudioSource {
  blob: Blob;
  fileName: string;
  origin: SttAudioOrigin;
  durationSec?: number;
}

const DEMO_SAMPLES = [
  { id: "female", label: "Voix féminine", path: "/samples/sample_female_fr.wav" },
  { id: "male", label: "Voix masculine", path: "/samples/sample_male_fr.wav" },
] as const;

const SOURCE_TABS: Array<{ id: SttAudioOrigin; label: string; icon: IconName }> = [
  { id: "mic", label: "Micro", icon: "mic" },
  { id: "upload", label: "Fichier", icon: "upload" },
  { id: "demo", label: "Démo", icon: "demo" },
];

const ORIGIN_LABELS: Record<SttAudioOrigin, string> = { mic: "Enregistrement micro", upload: "Fichier importé", demo: "Échantillon de démo" };

export function SttAudioSourcePanel({
  provider,
  tab,
  onTabChange,
  source,
  sourceUrl,
  onSourceChange,
  recorder,
  liveTranscript,
  liveError,
  disabled,
}: {
  provider: SttProviderId;
  tab: SttAudioOrigin;
  onTabChange: (tab: SttAudioOrigin) => void;
  source: SttAudioSource | null;
  sourceUrl: string | null;
  onSourceChange: (source: SttAudioSource | null) => void;
  recorder: { recording: boolean; stream: MediaStream | null; error: string | null };
  liveTranscript: string;
  liveError: string | null;
  disabled: boolean;
}) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elapsedMs = useElapsedTime(recorder.recording);
  useMediaStreamSpectrum(recorder.stream, canvasRef, { color: providerColorVar(provider) });

  const isWebSpeech = provider === "web-speech";
  const readySource = source?.origin === tab && !recorder.recording ? source : null;

  const acceptFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
      setUploadError(`Format non pris en charge (${file.type || "inconnu"}). Choisissez un fichier audio ou vidéo.`);
      return;
    }
    if (file.size > MAX_STT_UPLOAD_BYTES) {
      setUploadError(`Fichier trop volumineux (${formatBytes(file.size)}). La limite est de 50 Mo.`);
      return;
    }
    setUploadError(null);
    onSourceChange({ blob: file, fileName: file.name, origin: "upload" });
  };

  const loadDemo = async (sample: (typeof DEMO_SAMPLES)[number]) => {
    setLoadingDemo(sample.id);
    setUploadError(null);
    try {
      const response = await fetch(sample.path);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      onSourceChange({ blob: await response.blob(), fileName: sample.path.split("/").pop()!, origin: "demo" });
    } catch (err) {
      setUploadError(`Échantillon introuvable (${sample.path}).`);
      reportBrowserLog("error", "browser", "demo.load_failed", `Chargement de l'échantillon ${sample.path} impossible.`, { error: err });
    } finally {
      setLoadingDemo(null);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files[0]);
  };

  return (
    <div className="space-y-2.5">
      <div role="tablist" aria-label="Source audio" className="flex rounded-lg border border-line bg-sunken p-0.5">
        {SOURCE_TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            disabled={recorder.recording || disabled}
            onClick={() => onTabChange(id)}
            className={cn(
              "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm transition disabled:opacity-50",
              tab === id ? "bg-surface font-medium text-ink shadow-sm" : "text-muted enabled:hover:text-ink"
            )}
          >
            <Icon name={icon} size={17} /> {label}
          </button>
        ))}
      </div>

      {readySource && sourceUrl ? (
        // ANCHOR: audio prêt dans l'onglet courant : on l'identifie et on peut l'écouter avant de lancer la transcription.
        <div className="space-y-1.5 rounded-xl border border-line px-3 py-2">
          <div className="flex items-center gap-2">
            <Icon name="audioFile" className="text-[var(--provider)]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{readySource.fileName}</p>
              <p className="text-xs text-muted">
                {ORIGIN_LABELS[readySource.origin]}, <span className="tabular-nums">{formatBytes(readySource.blob.size)}</span>
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onSourceChange(null)} disabled={disabled}>
              Changer
            </Button>
          </div>
          <AudioPlayer src={sourceUrl} compact />
        </div>
      ) : tab === "mic" ? (
        <div className="space-y-2">
          {recorder.recording ? (
            <div className="relative h-16 overflow-hidden rounded-xl border border-line bg-sunken">
              <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden />
              <span aria-live="polite" className="absolute top-1.5 left-2 flex items-center gap-1.5 rounded-md bg-surface/80 px-1.5 text-xs tabular-nums text-ink">
                <span className="size-2 rounded-full bg-danger animate-pulse-dot" />
                {formatTimer(elapsedMs)}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted">
              {isWebSpeech ? "Le texte s'affiche en direct pendant que vous parlez." : "La transcription démarre dès l'arrêt de l'enregistrement."}
            </p>
          )}
          {isWebSpeech && (recorder.recording || liveTranscript) && (
            <div aria-live="polite" className="rounded-xl border border-dashed border-[var(--provider)] px-3 py-2 text-sm text-ink">
              {liveTranscript || <span className="text-muted">En écoute...</span>}
            </div>
          )}
          {recorder.error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{recorder.error}</p>}
          {isWebSpeech && liveError && <p className="text-sm text-warning">{liveError}</p>}
        </div>
      ) : tab === "upload" ? (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-xl border-2 border-dashed px-3 py-4 text-center transition",
            dragging ? "border-[var(--provider)] bg-[color-mix(in_srgb,var(--provider)_8%,transparent)]" : "border-line"
          )}
        >
          <div>
            <p className="text-sm text-ink">Déposez un fichier audio ou vidéo</p>
            <p className="text-xs text-muted">WAV, MP3, M4A, WebM, MP4, jusqu'à 50 Mo</p>
          </div>
          <Button size="sm" icon={<Icon name="upload" size={17} />} onClick={() => fileInputRef.current?.click()} disabled={disabled}>
            Choisir un fichier
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/*"
            className="hidden"
            onChange={(event) => {
              acceptFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {DEMO_SAMPLES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              disabled={disabled || loadingDemo !== null}
              onClick={() => void loadDemo(sample)}
              className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2 text-left transition enabled:hover:border-line-strong disabled:opacity-50"
            >
              <Icon name="demo" className="text-muted" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{sample.label}</span>
                <span className="block truncate text-xs text-muted">{loadingDemo === sample.id ? "Chargement..." : "Français, quelques secondes"}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {uploadError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{uploadError}</p>}
    </div>
  );
}
