"use client";

import { FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SttHistoryEntry } from "@/lib/shared/types";
import { CopyButton, FavoriteToggle, StarRating } from "@/components/ui/feedback-controls";
import { ProviderBadge } from "@/components/ui/provider-badge";
import { formatSeconds } from "@/lib/client/format";
import { providerStyle } from "@/lib/client/provider-style";
import { cn } from "@/lib/client/cn";

// SECTION: Résultat d'une transcription : texte, mesures (durée, RTF), segments cliquables, mots, note et favori.

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
}

export function SttTranscriptView({
  entry,
  sourceUrl,
  autoPlayToken,
  onToggleFavorite,
  onScore,
}: {
  entry: SttHistoryEntry | null;
  /** Audio local pas encore transcrit (aperçu avant envoi). */
  sourceUrl: string | null;
  autoPlayToken: number;
  onToggleFavorite: (id: string) => void;
  onScore: (id: string, score: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showWords, setShowWords] = useState(false);
  const audioUrl = entry?.url ?? sourceUrl;

  useEffect(() => {
    if (autoPlayToken === 0) return;
    audioRef.current?.play().catch(() => undefined);
  }, [autoPlayToken]);

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    void audio.play().catch(() => undefined);
  };

  const hasWords = entry?.segments.some((segment) => segment.words?.length) ?? false;

  return (
    <div style={entry ? providerStyle(entry.provider) : undefined} className="space-y-3">
      <audio ref={audioRef} src={audioUrl ?? undefined} controls preload="metadata" className="w-full" hidden={!audioUrl} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} />

      {!entry ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
          <FileText size={20} />
          {sourceUrl ? "Audio prêt. Lancez la transcription." : "Enregistrez, importez ou choisissez un échantillon pour obtenir sa transcription."}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <ProviderBadge provider={entry.provider} />
              <span className="rounded-md bg-sunken px-1.5 py-0.5 font-mono">{entry.modelSize}</span>
              <span className="rounded-md bg-sunken px-1.5 py-0.5 font-mono">{entry.device}</span>
              <span className="rounded-md bg-sunken px-1.5 py-0.5 font-mono">
                {entry.language}
                {entry.languageProbability ? ` ${(entry.languageProbability * 100).toFixed(0)} %` : ""}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <StarRating value={entry.score} onChange={(score) => onScore(entry.id, score)} />
              <FavoriteToggle active={entry.isFavorite} onToggle={() => onToggleFavorite(entry.id)} />
              <CopyButton text={entry.text} label="Copier le texte" />
            </div>
          </div>

          <p className="rounded-xl bg-sunken px-4 py-3 text-[0.95rem] leading-relaxed text-ink">{entry.text || <span className="text-muted">Aucune parole détectée.</span>}</p>

          <dl className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-muted">Durée audio</dt>
              <dd className="font-mono tabular-nums text-ink">{entry.durationSec.toFixed(1)} s</dd>
            </div>
            <div>
              <dt className="text-muted">Traitement</dt>
              <dd className="font-mono tabular-nums text-ink">{entry.processingTimeMs ? formatSeconds(entry.processingTimeMs) : "en direct"}</dd>
            </div>
            <div title="Real-time factor : temps de traitement divisé par la durée de l'audio. En dessous de 1, plus rapide que le temps réel.">
              <dt className="text-muted">RTF</dt>
              <dd className="font-mono tabular-nums text-ink">{entry.rtf ? `${entry.rtf.toFixed(3)}×` : "-"}</dd>
            </div>
          </dl>

          {entry.segments.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-medium text-muted">{entry.segments.length} segment{entry.segments.length > 1 ? "s" : ""}, cliquez pour réécouter</p>
                {hasWords && (
                  <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => setShowWords(!showWords)}>
                    {showWords ? "Masquer les mots" : "Afficher les mots"}
                  </button>
                )}
              </div>
              <ol className="max-h-72 space-y-1 overflow-y-auto pr-1">
                {entry.segments.map((segment) => {
                  const playing = currentTime >= segment.start && currentTime < segment.end;
                  return (
                    <li key={segment.id}>
                      <button
                        type="button"
                        onClick={() => seekTo(segment.start)}
                        className={cn(
                          "flex w-full gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition",
                          playing ? "bg-[color-mix(in_srgb,var(--provider)_12%,transparent)]" : "hover:bg-sunken"
                        )}
                      >
                        <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--provider)]">{formatTimestamp(segment.start)}</span>
                        <span className="text-ink">
                          {showWords && segment.words?.length
                            ? segment.words.map((word, i) => (
                                <span
                                  key={i}
                                  title={`${formatTimestamp(word.start)} · confiance ${(word.probability * 100).toFixed(0)} %`}
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
        </>
      )}
    </div>
  );
}
