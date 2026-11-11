"use client";

import { ChevronDown, History, Play } from "lucide-react";
import { useState } from "react";
import { STT_PROVIDER_IDS, type SttHistoryEntry, type SttProviderId } from "@/lib/shared/types";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDeleteButton, CopyButton, FavoriteToggle, StarRating } from "@/components/ui/feedback-controls";
import { EmptyState, Skeleton } from "@/components/ui/panel";
import { ProviderBadge } from "@/components/ui/provider-badge";
import { applyHistoryFilter, countHistoryFilters, HistoryFilterBar, type HistoryFilter } from "@/components/shared/history-filter-bar";
import { formatDateTime } from "@/lib/client/format";
import { providerStyle } from "@/lib/client/provider-style";
import { cn } from "@/lib/client/cn";

// SECTION: Historique des transcriptions STT : filtres, dépliage, réécoute, note, favori, suppression.

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

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <EmptyState icon={<History size={20} />} title="Historique illisible">
        <p>{loadError}</p>
        <Button size="sm" className="mt-3" onClick={onRetry}>
          Réessayer
        </Button>
      </EmptyState>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState icon={<History size={20} />} title="Aucune transcription">
        Chaque transcription apparaît ici, avec son RTF et sa note.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <HistoryFilterBar providers={STT_PROVIDER_IDS} value={filter} onChange={setFilter} counts={countHistoryFilters(items, STT_PROVIDER_IDS)} />
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setExpandedIds(allExpanded ? new Set() : new Set(visible.map((i) => i.id)))}>
            {allExpanded ? "Tout replier" : "Tout déplier"}
          </Button>
          <ConfirmDeleteButton label="Vider" confirmLabel={`Supprimer ${items.length} transcription${items.length > 1 ? "s" : ""}`} onConfirm={onClear} />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Aucune entrée pour ce filtre.</p>
      ) : (
        <ul className="max-h-[560px] space-y-1.5 overflow-y-auto pr-1">
          {visible.map((item) => {
            const expanded = expandedIds.has(item.id);
            return (
              <li
                key={item.id}
                style={providerStyle(item.provider)}
                className={cn("rounded-xl border bg-surface transition", item.id === activeEntryId ? "border-[var(--provider)]" : "border-line hover:border-line-strong")}
              >
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <IconButton label="Afficher et écouter" onClick={() => onOpen(item)} className="text-[var(--provider)] hover:text-[var(--provider)]">
                    <Play size={15} fill="currentColor" />
                  </IconButton>
                  <button type="button" aria-expanded={expanded} onClick={() => toggleExpanded(item.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm text-ink", !expanded && "truncate")}>{item.text || "(aucune parole détectée)"}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <ProviderBadge provider={item.provider} />
                        <span>{item.modelSize}</span>
                        <span className="font-mono tabular-nums">{item.durationSec.toFixed(1)} s</span>
                        {item.rtf > 0 && <span className="font-mono tabular-nums">RTF {item.rtf.toFixed(3)}</span>}
                        <span>{formatDateTime(item.createdAt)}</span>
                      </span>
                    </span>
                    <ChevronDown size={14} className={cn("shrink-0 text-muted transition-transform", expanded && "rotate-180")} />
                  </button>
                  <StarRating value={item.score} size={13} onChange={(score) => onScore(item.id, score)} />
                  <FavoriteToggle active={item.isFavorite} onToggle={() => onToggleFavorite(item.id)} />
                </div>

                {expanded && (
                  <div className="space-y-2 border-t border-line px-3 py-2 text-xs">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                      <div>
                        <dt className="text-muted">Matériel</dt>
                        <dd className="font-mono text-ink">{item.device}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Langue</dt>
                        <dd className="font-mono text-ink">{item.language}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Segments</dt>
                        <dd className="font-mono text-ink">{item.segments.length}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Fichier d'origine</dt>
                        <dd className="truncate font-mono text-ink">{item.originalFilename ?? "-"}</dd>
                      </div>
                    </dl>
                    {item.filePath && (
                      <div className="flex items-center gap-1 rounded-lg bg-sunken py-0.5 pr-0.5 pl-2">
                        <code className="min-w-0 flex-1 truncate text-muted" title={item.filePath}>{item.filePath}</code>
                        <CopyButton text={item.filePath} label="Copier le chemin du fichier" />
                      </div>
                    )}
                    <div className="flex flex-wrap justify-end gap-1">
                      <CopyButton text={item.text} label="Copier le texte" />
                      <ConfirmDeleteButton label="Supprimer" onConfirm={() => onDelete(item.id)} />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
