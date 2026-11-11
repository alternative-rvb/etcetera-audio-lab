import type { ReactNode } from "react";

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
        <div key={tile.label} className="bg-surface px-4 py-3" title={tile.hint}>
          <dt className="text-xs text-muted">{tile.label}</dt>
          <dd className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-ink">{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function averageOf(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
