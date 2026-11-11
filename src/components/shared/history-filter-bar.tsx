"use client";

import { Heart } from "lucide-react";
import type { LogSource } from "@/lib/shared/types";
import { LOG_SOURCE_LABELS, providerColorVar } from "@/lib/shared/provider-catalog";
import { cn } from "@/lib/client/cn";

// SECTION: Filtres d'historique communs : tout, favoris, puis un filtre par provider avec son compteur.

export type HistoryFilter<P extends LogSource> = "all" | "favorites" | P;

export function HistoryFilterBar<P extends LogSource>({
  providers,
  value,
  onChange,
  counts,
}: {
  providers: readonly P[];
  value: HistoryFilter<P>;
  onChange: (filter: HistoryFilter<P>) => void;
  counts: Record<HistoryFilter<P>, number>;
}) {
  const options: Array<{ id: HistoryFilter<P>; label: string; color?: string }> = [
    { id: "all", label: "Tout" },
    { id: "favorites", label: "Favoris" },
    ...providers.map((provider) => ({ id: provider as HistoryFilter<P>, label: LOG_SOURCE_LABELS[provider], color: providerColorVar(provider) })),
  ];

  return (
    <div role="tablist" aria-label="Filtrer l'historique" className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = value === option.id;
        const count = counts[option.id] ?? 0;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            disabled={count === 0 && option.id !== "all" && !active}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition disabled:opacity-40",
              active ? "border-ink bg-ink text-bg retro:border-accent retro:bg-accent retro:text-accent-contrast" : "border-line text-muted enabled:hover:border-line-strong enabled:hover:text-ink"
            )}
          >
            {option.id === "favorites" && <Heart size={11} />}
            {option.color && <span className="size-2 rounded-full" style={{ background: option.color }} />}
            {option.label}
            <span className="tabular-nums opacity-70">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

export function countHistoryFilters<P extends LogSource>(
  items: Array<{ provider: P; isFavorite: boolean }>,
  providers: readonly P[]
): Record<HistoryFilter<P>, number> {
  const counts = { all: items.length, favorites: items.filter((i) => i.isFavorite).length } as Record<HistoryFilter<P>, number>;
  for (const provider of providers) counts[provider] = items.filter((i) => i.provider === provider).length;
  return counts;
}

export function applyHistoryFilter<P extends LogSource, T extends { provider: P; isFavorite: boolean }>(items: T[], filter: HistoryFilter<P>): T[] {
  if (filter === "all") return items;
  if (filter === "favorites") return items.filter((i) => i.isFavorite);
  return items.filter((i) => i.provider === filter);
}
