"use client";

import { useState } from "react";
import type { TtsHistoryEntry, TtsProviderId } from "@/lib/shared/types";
import { TTS_PROVIDER_CATALOG } from "@/lib/shared/provider-catalog";
import { AudioPlayer } from "@/components/ui/audio-player";
import { CopyButton, FavoriteToggle, StarRating } from "@/components/ui/feedback-controls";
import { Panel } from "@/components/ui/panel";
import { ProviderBadge } from "@/components/ui/provider-badge";
import { RuntimeBadge } from "@/components/ui/runtime-badge";
import { formatBytes, formatClock, formatSeconds } from "@/lib/client/format";
import { providerStyle } from "@/lib/client/provider-style";

// SECTION: Panneau Écoute : dit quel audio est chargé (origine, moteur, voix, texte, fichier), le lit et permet de le juger.

/** D'où vient l'audio affiché : génération qui vient de finir, clic dans l'historique, ou dernier audio au chargement de la page. */
export type ListenOrigin = "generated" | "history" | "latest";

const ORIGIN_LABELS: Record<ListenOrigin, string> = {
  generated: "Dernière génération",
  history: "Depuis l'historique",
  latest: "Dernier audio enregistré",
};

export function TtsAudioMonitor({
  entry,
  origin,
  selectedProvider,
  autoPlayToken,
  onToggleFavorite,
  onScore,
}: {
  entry: TtsHistoryEntry | null;
  origin: ListenOrigin;
  selectedProvider: TtsProviderId;
  /** Change à chaque nouvelle génération ou clic dans l'historique, déclenche la lecture automatique. */
  autoPlayToken: number;
  onToggleFavorite: (id: string) => void;
  onScore: (id: string, score: number) => void;
}) {
  const [textExpanded, setTextExpanded] = useState(false);

  return (
    <Panel title="Écoute" meta={entry ? `${ORIGIN_LABELS[origin]}, ${formatClock(entry.createdAt)}` : undefined}>
      {!entry ? (
        <p className="py-4 text-center text-sm text-muted">Aucun audio pour l'instant. Écrivez un texte puis lancez la génération.</p>
      ) : (
        <div style={providerStyle(entry.provider)} className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ProviderBadge provider={entry.provider} />
            <span className="min-w-0 truncate text-sm font-medium text-ink">{entry.voiceName}</span>
            <div className="ml-auto flex items-center">
              <StarRating value={entry.score} onChange={(score) => onScore(entry.id, score)} />
              <FavoriteToggle active={entry.isFavorite} onToggle={() => onToggleFavorite(entry.id)} />
            </div>
            {entry.provider !== selectedProvider && (
              <p className="w-full text-xs text-muted">Moteur sélectionné pour la prochaine génération : {TTS_PROVIDER_CATALOG[selectedProvider].label}.</p>
            )}
          </div>

          <button
            type="button"
            aria-expanded={textExpanded}
            onClick={() => setTextExpanded(!textExpanded)}
            className="block w-full rounded-lg bg-sunken px-3 py-2 text-left text-sm leading-relaxed text-ink"
          >
            <span className={textExpanded ? undefined : "line-clamp-2"}>{entry.text}</span>
            <span className="sr-only">{textExpanded ? ", réduire le texte" : ", afficher tout le texte"}</span>
          </button>

          <AudioPlayer src={entry.url} downloadName={entry.fileName} autoPlayToken={autoPlayToken} />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>
              Généré en <span className="font-medium text-ink tabular-nums">{formatSeconds(entry.generationTimeMs)}</span>
            </span>
            <span className="tabular-nums">{formatBytes(entry.sizeBytes)}</span>
            <span>{TTS_PROVIDER_CATALOG[entry.provider].output ?? entry.format.toUpperCase()}</span>
            <RuntimeBadge trace={entry} />
            <span className="flex min-w-0 flex-1 basis-40 items-center justify-end gap-0.5">
              <code className="min-w-0 truncate font-mono">{entry.fileName}</code>
              <CopyButton text={entry.filePath} label="Copier le chemin complet du fichier" />
            </span>
          </div>
        </div>
      )}
    </Panel>
  );
}
