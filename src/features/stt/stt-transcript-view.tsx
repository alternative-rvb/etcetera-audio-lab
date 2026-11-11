"use client";

import { useMemo, useRef, useState } from "react";
import type { SttHistoryEntry } from "@/lib/shared/types";
import { AudioPlayer, type AudioPlayerHandle } from "@/components/ui/audio-player";
import { CopyButton, FavoriteToggle } from "@/components/ui/feedback-controls";
import { Panel } from "@/components/ui/panel";
import { ProviderBadge } from "@/components/ui/provider-badge";
import { compareToPeers, MeasureHeadline } from "@/components/ui/measure-headline";
import { STT_PROVIDER_CATALOG } from "@/lib/shared/provider-catalog";
import { formatClock } from "@/lib/client/format";
import { HARDWARE_LABELS, sttHardware } from "@/lib/shared/hardware";
import { providerStyle } from "@/lib/client/provider-style";
import { cn } from "@/lib/client/cn";

// SECTION: Résultat d'une transcription : origine, texte, lecteur synchronisé avec les segments cliquables, mesures, note et favori.

/** D'où vient la transcription affichée : celle qui vient de finir, un clic dans l'historique, ou la dernière au chargement. */
export type TranscriptOrigin = "transcribed" | "history" | "latest";

const ORIGIN_LABELS: Record<TranscriptOrigin, string> = {
  transcribed: "Dernière transcription",
  history: "Depuis l'historique",
  latest: "Dernière transcription enregistrée",
};

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
}

export function SttTranscriptView({
  entry,
  peers,
  origin,
  autoPlayToken,
  onToggleFavorite,
  onScore,
}: {
  entry: SttHistoryEntry | null;
  /** Historique complet, pour comparer le RTF aux essais précédents du même moteur. */
  peers: SttHistoryEntry[];
  origin: TranscriptOrigin;
  autoPlayToken: number;
  onToggleFavorite: (id: string) => void;
  onScore: (id: string, score: number) => void;
}) {
  const playerRef = useRef<AudioPlayerHandle | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showWords, setShowWords] = useState(false);
  const hasWords = entry?.segments.some((segment) => segment.words?.length) ?? false;
  // NOTE: comparaison sur le RTF, indépendant de la durée de l'audio ; même moteur et même modèle.
  const comparison = useMemo(() => {
    if (!entry || entry.rtf <= 0) return undefined;
    const others = peers.filter((item) => item.provider === entry.provider && item.modelSize === entry.modelSize && sttHardware(item) === sttHardware(entry) && item.id !== entry.id);
    return compareToPeers(entry.rtf, others.map((item) => item.rtf), `${STT_PROVIDER_CATALOG[entry.provider].label} ${entry.modelSize} sur ${HARDWARE_LABELS[sttHardware(entry)]}`, "RTF");
  }, [entry, peers]);

  return (
    <Panel title="Résultat" meta={entry ? `${ORIGIN_LABELS[origin]}, ${formatClock(entry.createdAt)}` : undefined}>
      {!entry ? (
        <p className="py-4 text-center text-sm text-muted">Aucune transcription pour l'instant. Choisissez un audio puis lancez la transcription.</p>
      ) : (
        <div style={providerStyle(entry.provider)} className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ProviderBadge provider={entry.provider} />
            <span className="min-w-0 truncate text-sm font-medium text-ink">{entry.originalFilename ?? "Enregistrement micro"}</span>
            <div className="ml-auto flex items-center">
              <FavoriteToggle active={entry.isFavorite} onToggle={() => onToggleFavorite(entry.id)} />
              <CopyButton text={entry.text} label="Copier le texte" />
            </div>
            <p className="w-full text-xs text-muted">
              Modèle {entry.modelSize}, {entry.device.toUpperCase()}, langue {entry.language}
              {entry.languageProbability ? ` (${(entry.languageProbability * 100).toFixed(0)} %)` : ""}
            </p>
          </div>

          <MeasureHeadline
            timeLabel="Transcrit en"
            timeMs={entry.processingTimeMs}
            realtimeFactor={entry.rtf > 0 ? 1 / entry.rtf : undefined}
            realtimeDetail={`RTF ${entry.rtf.toFixed(3)} : temps de traitement divisé par la durée de l'audio (${entry.durationSec.toFixed(1)} s).`}
            comparison={comparison}
            trace={entry}
            hardware={sttHardware(entry)}
            score={entry.score}
            onScore={(score) => onScore(entry.id, score)}
          />

          <p className="rounded-lg bg-sunken px-3 py-2 text-[0.95rem] leading-relaxed text-ink">{entry.text || <span className="text-muted">Aucune parole détectée.</span>}</p>

          {entry.url && (
            <AudioPlayer src={entry.url} downloadName={entry.fileName} autoPlayToken={autoPlayToken} handleRef={playerRef} onTimeUpdate={setCurrentTime} />
          )}

          {entry.segments.length > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs text-muted">
                  {entry.segments.length} segment{entry.segments.length > 1 ? "s" : ""}, cliquez pour réécouter
                </p>
                {hasWords && (
                  <button type="button" aria-pressed={showWords} className="text-xs text-muted hover:text-ink" onClick={() => setShowWords(!showWords)}>
                    {showWords ? "Masquer les mots" : "Afficher les mots"}
                  </button>
                )}
              </div>
              <ol className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
                {entry.segments.map((segment) => {
                  const playing = currentTime >= segment.start && currentTime < segment.end;
                  return (
                    <li key={segment.id}>
                      <button
                        type="button"
                        aria-current={playing || undefined}
                        onClick={() => playerRef.current?.seek(segment.start)}
                        disabled={!entry.url}
                        className={cn(
                          "flex w-full gap-2.5 rounded-lg px-2 py-1 text-left text-sm transition",
                          playing ? "bg-[color-mix(in_srgb,var(--provider)_12%,transparent)]" : "enabled:hover:bg-sunken"
                        )}
                      >
                        <span className="shrink-0 pt-px text-xs tabular-nums text-[var(--provider)]">{formatTimestamp(segment.start)}</span>
                        <span className="min-w-0 text-ink">
                          {showWords && segment.words?.length
                            ? segment.words.map((word, i) => (
                                <span
                                  key={i}
                                  title={`${formatTimestamp(word.start)}, confiance ${(word.probability * 100).toFixed(0)} %`}
                                  className={cn(word.probability < 0.5 && "text-warning underline decoration-dotted")}
                                >
                                  {word.word}
                                </span>
                              ))
                            : segment.text}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
