"use client";

import { useState } from "react";
import { STT_PROVIDER_IDS, type SttHistoryEntry, type SttProviderId } from "@/lib/shared/types";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDeleteButton, CopyButton, FavoriteToggle, StarRating } from "@/components/ui/feedback-controls";
import { Icon } from "@/components/ui/icon";
import { EmptyState, Panel, Skeleton } from "@/components/ui/panel";
import { ProviderBadge } from "@/components/ui/provider-badge";
import { RuntimeBadge } from "@/components/ui/runtime-badge";
import { applyHistoryFilter, countHistoryFilters, HistoryFilterBar, type HistoryFilter } from "@/components/shared/history-filter-bar";
import { formatDateTime, formatSeconds } from "@/lib/client/format";
import { providerStyle } from "@/lib/client/provider-style";
import { cn } from "@/lib/client/cn";

// SECTION: Historique des transcriptions STT : filtres, réécoute, note, favori, copie, suppression, détails dépliables.

const MAX_STT_HISTORY = 100;

export function SttHistoryList({
  items,
  loading,
  loadError,
  activeEntryId,
  onOpen,
  onToggleFavorite,
  onScore,
  onDelete,
  onClear,
  onRetry,
}: {
  items: SttHistoryEntry[];
  loading: boolean;
  loadError: string | null;
  activeEntryId: string | null;
  onOpen: (entry: SttHistoryEntry) => void;
  onToggleFavorite: (id: string) => void;
  onScore: (id: string, score: number) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onRetry: () => void;
}) {
  const [filter, setFilter] = useState<HistoryFilter<SttProviderId>>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const visible = applyHistoryFilter(items, filter);
  const allExpanded = visible.length > 0 && visible.every((item) => expandedIds.has(item.id));

  const toggleExpanded = (id: string) =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const actions =
    items.length > 0 && !loading && !loadError ? (
      <>
        <span className="mr-1 text-xs text-muted tabular-nums">
          {items.length} / {MAX_STT_HISTORY}
        </span>
        <IconButton label={allExpanded ? "Replier tous les détails" : "Déplier tous les détails"} onClick={() => setExpandedIds(allExpanded ? new Set() : new Set(visible.map((i) => i.id)))}>
          <Icon name={allExpanded ? "unfoldLess" : "unfoldMore"} />
        </IconButton>
        <ConfirmDeleteButton compact label="Vider l'historique" confirmLabel={`Supprimer ${items.length} transcription${items.length > 1 ? "s" : ""}`} onConfirm={onClear} />
      </>
    ) : null;

  return (
    <Panel title="Historique" actions={actions}>
      {loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : loadError ? (
        <EmptyState title="Historique illisible">
          <p>{loadError}</p>
          <Button size="sm" className="mt-2" onClick={onRetry}>
            Réessayer
          </Button>
        </EmptyState>
      ) : items.length === 0 ? (
        <EmptyState title="Aucune transcription">Chaque transcription apparaît ici, avec son RTF et sa note.</EmptyState>
      ) : (
        <div className="space-y-2">
          <HistoryFilterBar providers={STT_PROVIDER_IDS} value={filter} onChange={setFilter} counts={countHistoryFilters(items, STT_PROVIDER_IDS)} />

          {visible.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">Aucune entrée pour ce filtre.</p>
          ) : (
            <ul className="max-h-[560px] space-y-1 overflow-y-auto pr-1">
              {visible.map((item) => {
                const expanded = expandedIds.has(item.id);
                return (
                  <li
                    key={item.id}
                    style={providerStyle(item.provider)}
                    className={cn("rounded-xl border bg-surface transition", item.id === activeEntryId ? "border-[var(--provider)]" : "border-line hover:border-line-strong")}
                  >
                    {/* ANCHOR: à 400 px, les actions passent sous le texte (basis calculée) au lieu d'écraser l'extrait. */}
                    <div className="flex flex-wrap items-center gap-x-1 px-1.5 py-1">
                      <IconButton label="Afficher et écouter" onClick={() => onOpen(item)} className="text-[var(--provider)] hover:text-[var(--provider)]">
                        <Icon name="play" size={22} />
                      </IconButton>
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => toggleExpanded(item.id)}
                        className="min-w-0 flex-1 basis-[calc(100%-2.5rem)] py-0.5 text-left sm:basis-0"
                      >
                        <span className={cn("block text-sm text-ink", !expanded && "truncate")}>{item.text || "(aucune parole détectée)"}</span>
                        <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                          <ProviderBadge provider={item.provider} />
                          <span className="font-semibold text-ink tabular-nums">{item.processingTimeMs ? formatSeconds(item.processingTimeMs) : "direct"}</span>
                          <span>{item.modelSize}</span>
                          <span className="tabular-nums">audio {item.durationSec.toFixed(1)} s</span>
                          {item.rtf > 0 && <span className="tabular-nums">RTF {item.rtf.toFixed(3)}</span>}
                          <span className="tabular-nums">{formatDateTime(item.createdAt)}</span>
                          <RuntimeBadge trace={item} />
                        </span>
                      </button>
                      <div className="ml-auto flex items-center">
                        <StarRating value={item.score} size={14} onChange={(score) => onScore(item.id, score)} />
                        <FavoriteToggle active={item.isFavorite} onToggle={() => onToggleFavorite(item.id)} />
                        <CopyButton text={item.text} label="Copier le texte" />
                        <ConfirmDeleteButton compact label="Supprimer cette transcription" confirmLabel="Supprimer" onConfirm={() => onDelete(item.id)} />
                      </div>
                    </div>

                    {expanded && (
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line px-3 py-2 text-xs sm:grid-cols-4">
                        <div>
                          <dt className="text-muted">Matériel, langue</dt>
                          <dd className="text-ink">
                            {item.device.toUpperCase()}, {item.language}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted">Segments</dt>
                          <dd className="text-ink tabular-nums">{item.segments.length}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-muted">Fichier d'origine</dt>
                          <dd className="truncate text-ink">{item.originalFilename ?? "Enregistrement micro"}</dd>
                        </div>
                        {item.fileName && item.filePath && (
                          <div className="min-w-0">
                            <dt className="text-muted">Fichier</dt>
                            <dd className="flex items-center gap-0.5">
                              <code className="min-w-0 truncate font-mono text-ink">{item.fileName}</code>
                              <CopyButton text={item.filePath} label="Copier le chemin complet du fichier" />
                            </dd>
                          </div>
                        )}
                      </dl>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}
