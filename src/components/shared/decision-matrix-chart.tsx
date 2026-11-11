"use client";

import { useEffect, useRef, useState } from "react";
import type { LogSource } from "@/lib/shared/types";
import { LOG_SOURCE_LABELS, providerColorVar } from "@/lib/shared/provider-catalog";

// SECTION: Matrice de décision commune TTS/STT : note (axe Y) en fonction de la vitesse (axe X).
// ANCHOR: en haut à gauche = rapide et bien noté, la zone à viser.

export interface DecisionMatrixPoint {
  id: string;
  provider: LogSource;
  score: number;
  x: number;
  title: string;
  subtitle?: string;
}

// NOTE: la largeur du viewBox suit celle du conteneur (ResizeObserver) pour garder un texte à sa taille réelle.
const HEIGHT = 220;
const PADDING = { top: 14, right: 16, bottom: 36, left: 36 };
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

export function DecisionMatrixChart({
  points,
  xLabel,
  formatX,
  minXDomain,
  onSelect,
  emptyMessage,
}: {
  points: DecisionMatrixPoint[];
  xLabel: string;
  formatX: (value: number) => string;
  /** Borne minimale de l'axe X, pour éviter un axe écrasé avec une seule mesure. */
  minXDomain: number;
  onSelect?: (id: string) => void;
  emptyMessage: string;
}) {
  const [hovered, setHovered] = useState<DecisionMatrixPoint | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const hasRated = points.some((p) => p.score > 0 && p.x > 0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(container);
    return () => observer.disconnect();
  }, [hasRated]);

  const WIDTH = width;
  const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
  const X_TICKS = width < 480 ? 3 : 4;
  const rated = points.filter((p) => p.score > 0 && p.x > 0);
  const maxX = Math.max(minXDomain, ...rated.map((p) => p.x)) * 1.12;
  const providersShown = [...new Set(rated.map((p) => p.provider))];

  if (rated.length === 0) {
    return <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  const toX = (value: number) => PADDING.left + (value / maxX) * PLOT_WIDTH;
  const toY = (score: number) => PADDING.top + PLOT_HEIGHT - ((score - 0.5) / 3) * PLOT_HEIGHT;

  return (
    <div>
      <div ref={containerRef} className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT} className="block max-w-full" role="img" aria-label={`Matrice de décision : note en fonction de ${xLabel.toLowerCase()}`}>
          {/* NOTE: zone idéale (rapide et bien noté) légèrement teintée */}
          <rect x={PADDING.left} y={PADDING.top} width={PLOT_WIDTH / 2} height={PLOT_HEIGHT / 3} fill="var(--success)" opacity={0.07} rx={4} />

          {[1, 2, 3].map((score) => (
            <g key={score}>
              <line x1={PADDING.left} x2={PADDING.left + PLOT_WIDTH} y1={toY(score)} y2={toY(score)} stroke="var(--border)" strokeDasharray="3 4" />
              <text x={PADDING.left - 10} y={toY(score) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">
                {score}★
              </text>
            </g>
          ))}

          <line x1={PADDING.left} x2={PADDING.left + PLOT_WIDTH} y1={PADDING.top + PLOT_HEIGHT} y2={PADDING.top + PLOT_HEIGHT} stroke="var(--border-strong)" />
          {Array.from({ length: X_TICKS + 1 }, (_, i) => {
            const value = (maxX / X_TICKS) * i;
            return (
              <text key={i} x={toX(value)} y={PADDING.top + PLOT_HEIGHT + 16} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
                {formatX(value)}
              </text>
            );
          })}
          <text x={PADDING.left + PLOT_WIDTH} y={HEIGHT - 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">
            {xLabel} →
          </text>

          {rated.map((point) => {
            const isHovered = hovered?.id === point.id;
            return (
              <circle
                key={point.id}
                cx={toX(point.x)}
                cy={toY(point.score)}
                r={isHovered ? 8 : 6}
                fill={providerColorVar(point.provider)}
                stroke="var(--surface)"
                strokeWidth={2}
                tabIndex={onSelect ? 0 : -1}
                role={onSelect ? "button" : undefined}
                aria-label={`${point.title}, ${LOG_SOURCE_LABELS[point.provider]}, ${point.score} sur 3, ${formatX(point.x)}`}
                className="cursor-pointer transition-[r] focus:outline-none"
                onMouseEnter={() => setHovered(point)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(point)}
                onBlur={() => setHovered(null)}
                onClick={() => onSelect?.(point.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect?.(point.id);
                  }
                }}
              />
            );
          })}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute z-10 max-w-[240px] -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
            style={{ left: `${(toX(hovered.x) / WIDTH) * 100}%`, top: `calc(${(toY(hovered.score) / HEIGHT) * 100}% - 12px)` }}
          >
            <p className="font-semibold text-ink">{hovered.title}</p>
            <p className="text-muted">
              {LOG_SOURCE_LABELS[hovered.provider]}, {hovered.score}/3, {formatX(hovered.x)}
            </p>
            {hovered.subtitle && <p className="mt-1 line-clamp-2 text-muted">{hovered.subtitle}</p>}
          </div>
        )}
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {providersShown.map((provider) => (
          <li key={provider} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: providerColorVar(provider) }} />
            {LOG_SOURCE_LABELS[provider]}
          </li>
        ))}
        {onSelect && <li className="ml-auto">Cliquez sur un point pour le réécouter.</li>}
      </ul>
    </div>
  );
}
