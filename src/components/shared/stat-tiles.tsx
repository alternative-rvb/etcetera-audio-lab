import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";

// SECTION: Rangée de chiffres clés (générations, note moyenne, vitesse, favoris).

export interface StatTile {
  label: string;
  value: ReactNode;
  hint?: string;
}

export function StatTiles({ tiles }: { tiles: StatTile[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="bg-surface px-3 py-2">
          <dt className="flex items-center gap-1 text-xs text-muted">
            {tile.label}
            {tile.hint && (
              <Tooltip label={tile.hint}>
                <button type="button" aria-label={`Aide : ${tile.hint}`} className="inline-flex hover:text-ink">
                  <Icon name="info" size={13} />
                </button>
              </Tooltip>
            )}
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-ink">{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function averageOf(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
