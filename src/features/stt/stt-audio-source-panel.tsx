"use client";

import { FileAudio, Mic, Square, Upload, UserRound } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import type { SttProviderId } from "@/lib/shared/types";
import { providerColorVar } from "@/lib/shared/provider-catalog";
import { Button } from "@/components/ui/button";
import { useMediaStreamSpectrum } from "@/hooks/use-audio-spectrum";
import { useElapsedTime } from "@/hooks/use-elapsed-time";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { reportBrowserLog } from "@/lib/client/browser-logger";
import { formatBytes, formatTimer } from "@/lib/client/format";
import { cn } from "@/lib/client/cn";

// SECTION: Source audio à transcrire : micro (avec spectre et texte Web Speech en direct), fichier importé, échantillon de démo.

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

const SOURCE_TABS: Array<{ id: SttAudioOrigin; label: string; icon: typeof Mic }> = [
  { id: "mic", label: "Micro", icon: Mic },
  { id: "upload", label: "Fichier", icon: Upload },
  { id: "demo", label: "Démo", icon: UserRound },
];

export function SttAudioSourcePanel({
  provider,
  source,
  onSourceChange,
  recorder,
  liveTranscript,
  liveError,
  disabled,
}: {
  provider: SttProviderId;
  source: SttAudioSource | null;
  onSourceChange: (source: SttAudioSource) => void;
  recorder: { start: () => void; stop: () => void; recording: boolean; stream: MediaStream | null; error: string | null };
  liveTranscript: string;
  liveError: string | null;
  disabled: boolean;
}) {
  const [tab, setTab] = usePersistentState<SttAudioOrigin>("stt-source-tab", "mic");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elapsedMs = useElapsedTime(recorder.recording);
  useMediaStreamSpectrum(recorder.stream, canvasRef, { color: providerColorVar(provider) });

  const isWebSpeech = provider === "web-speech";

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
    <div className="space-y-4">
      <div role="tablist" aria-label="Source audio" className="inline-flex rounded-lg border border-line bg-sunken p-0.5">
        {SOURCE_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            disabled={recorder.recording}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm transition disabled:opacity-50",
              tab === id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
            )}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "mic" && (
        <div className="space-y-3">
          <div className="relative h-24 overflow-hidden rounded-xl border border-line bg-sunken">
            <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden />
            {!recorder.recording && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">
                {isWebSpeech ? "Parlez après avoir lancé l'enregistrement : le texte s'affiche en direct." : "La transcription démarre automatiquement à l'arrêt de l'enregistrement."}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {recorder.recording ? (
              <Button variant="danger" size="lg" className="border-danger/50 bg-danger/10" icon={<Square size={14} fill="currentColor" />} onClick={recorder.stop}>
                Arrêter l'enregistrement
              </Button>
            ) : (
              <Button variant="primary" size="lg" icon={<Mic size={16} />} onClick={recorder.start} disabled={disabled}>
                {source?.origin === "mic" ? "Enregistrer à nouveau" : "Enregistrer"}
              </Button>
            )}
            {recorder.recording && (
              <span aria-live="polite" className="flex items-center gap-2 font-mono text-sm tabular-nums text-ink">
                <span className="size-2 rounded-full bg-danger animate-pulse-dot" />
                {formatTimer(elapsedMs)}
              </span>
            )}
          </div>
          {recorder.error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{recorder.error}</p>}
          {isWebSpeech && (recorder.recording || liveTranscript) && (
            <div aria-live="polite" className="rounded-xl border border-dashed border-[var(--provider)] px-3 py-2 text-sm text-ink">
              {liveTranscript || <span className="text-muted">En écoute...</span>}
            </div>
          )}
          {isWebSpeech && liveError && <p className="text-sm text-warning">{liveError}</p>}
        </div>
      )}

      {tab === "upload" && (
        <div className="space-y-2">
          {isWebSpeech && <WebSpeechSourceNotice />}
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition",
              dragging ? "border-[var(--provider)] bg-[color-mix(in_srgb,var(--provider)_8%,transparent)]" : "border-line"
            )}
          >
            <FileAudio size={22} className="text-muted" />
            <p className="text-sm text-ink">Déposez un fichier audio ou vidéo ici</p>
            <p className="text-xs text-muted">WAV, MP3, M4A, WebM, MP4... jusqu'à 50 Mo</p>
            <Button size="sm" className="mt-1" onClick={() => fileInputRef.current?.click()} disabled={disabled}>
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
        </div>
      )}

      {tab === "demo" && (
        <div className="space-y-2">
          {isWebSpeech && <WebSpeechSourceNotice />}
          <div className="grid gap-2 sm:grid-cols-2">
            {DEMO_SAMPLES.map((sample) => (
              <button
                key={sample.id}
                type="button"
                disabled={disabled || loadingDemo !== null}
                onClick={() => void loadDemo(sample)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition disabled:opacity-50",
                  source?.origin === "demo" && source.fileName === sample.path.split("/").pop() ? "border-[var(--provider)]" : "border-line hover:border-line-strong"
                )}
              >
                <UserRound size={18} className="text-muted" />
                <span>
                  <span className="block text-sm font-medium text-ink">{sample.label}</span>
                  <span className="text-xs text-muted">{loadingDemo === sample.id ? "Chargement..." : "Échantillon français, quelques secondes"}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {uploadError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{uploadError}</p>}
    </div>
  );
}

function WebSpeechSourceNotice() {
  return (
    <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
      Web Speech ne transcrit qu'en direct au micro. Pour un fichier ou un échantillon, choisissez Whisper ou Sherpa.
    </p>
  );
}
