"use client";

import { AudioLines } from "lucide-react";
import { useEffect, useRef } from "react";
import type { TtsHistoryEntry } from "@/lib/shared/types";
import { TTS_PROVIDER_CATALOG, providerColorVar } from "@/lib/shared/provider-catalog";
import { CopyButton, FavoriteToggle, StarRating } from "@/components/ui/feedback-controls";
import { ProviderBadge } from "@/components/ui/provider-badge";
import { useMediaElementSpectrum } from "@/hooks/use-audio-spectrum";
import { formatBytes, formatSeconds } from "@/lib/client/format";
import { providerStyle } from "@/lib/client/provider-style";

// SECTION: Écoute du dernier audio : lecteur, spectre aux couleurs du provider, note, favori, détails techniques.

export function TtsAudioMonitor({
  entry,
  autoPlayToken,
  onToggleFavorite,
  onScore,
}: {
  entry: TtsHistoryEntry | null;
  /** Change à chaque nouvelle génération ou rechargement explicite, déclenche la lecture automatique. */
  autoPlayToken: number;
  onToggleFavorite: (id: string) => void;
  onScore: (id: string, score: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useMediaElementSpectrum(audioRef, canvasRef, { color: entry ? providerColorVar(entry.provider) : "var(--accent)" });

  // NOTE: lecture automatique uniquement sur demande explicite (nouvelle génération, clic dans l'historique ou la matrice).
  useEffect(() => {
    if (autoPlayToken === 0) return;
    audioRef.current?.play().catch(() => undefined);
  }, [autoPlayToken]);

  return (
    <div style={entry ? providerStyle(entry.provider) : undefined} className="space-y-3">
      <div className="relative h-24 overflow-hidden rounded-xl border border-line bg-sunken">
        <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden />
        {!entry && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-sm text-muted">
            <AudioLines size={20} />
            Le spectre s'anime pendant la lecture.
          </div>
        )}
      </div>

      {/* ANCHOR: l'élément <audio> reste monté en permanence (un MediaElementSource ne se crée qu'une fois par élément). */}
      <audio ref={audioRef} src={entry?.url} controls preload="metadata" className="w-full" hidden={!entry} />

      {entry ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <ProviderBadge provider={entry.provider} />
              <span className="truncate text-sm font-medium text-ink">{entry.voiceName}</span>
            </div>
            <div className="flex items-center gap-1">
              <StarRating value={entry.score} onChange={(score) => onScore(entry.id, score)} />
              <FavoriteToggle active={entry.isFavorite} onToggle={() => onToggleFavorite(entry.id)} />
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-muted">Génération</dt>
              <dd className="font-mono tabular-nums text-ink">{formatSeconds(entry.generationTimeMs)}</dd>
            </div>
            <div>
              <dt className="text-muted">Taille</dt>
              <dd className="font-mono tabular-nums text-ink">{formatBytes(entry.sizeBytes)}</dd>
            </div>
            <div>
              <dt className="text-muted">Format</dt>
              <dd className="font-mono text-ink">{TTS_PROVIDER_CATALOG[entry.provider].output ?? entry.format.toUpperCase()}</dd>
            </div>
          </dl>
          <div className="flex items-center gap-1 rounded-lg bg-sunken py-1 pr-1 pl-3">
            <code className="min-w-0 flex-1 truncate text-xs text-muted" title={entry.filePath}>
              {entry.filePath}
            </code>
            <CopyButton text={entry.filePath} label="Copier le chemin du fichier" />
          </div>
        </>
      ) : (
        <p className="text-center text-sm text-muted">Aucun audio pour l'instant. Écrivez un texte puis lancez la génération.</p>
      )}
    </div>
  );
}
