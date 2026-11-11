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
  /** "ai" : note automatique, dessinée en anneau ; absent ou "manual" : disque plein. */
  source?: "manual" | "ai";
  /** Traitement instantané côté serveur (ex. Web Speech) : placé sur l'axe à x = 0, étiquette « direct ». */
  direct?: boolean;
  /** Date ISO de l'essai : le plus récent est dessiné au premier plan quand des points se superposent. */
  createdAt?: string;
  /** Nombre d'essais regroupés dans ce point (moyenne par moteur). */
  count?: number;
  /** Texte du badge, à la place du nom court du moteur (ex. couple STT + TTS sur la page Écho). */
  badge?: string;
  /** Second moteur d'un couple (STT de la page Écho) : le point et le badge passent en dégradé provider → moteur secondaire. */
  altProvider?: LogSource;
}

// NOTE: la largeur du viewBox suit celle du conteneur (ResizeObserver) pour garder un texte à sa taille réelle.
const HEIGHT = 220;
const PADDING = { top: 14, right: 16, bottom: 36, left: 36 };
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

const BADGE_H = 16;
const LAYER_STEP = 4;

export const shortProviderLabel = (provider: LogSource) => SHORT_LABELS[provider] ?? LOG_SOURCE_LABELS[provider];

const SHORT_LABELS: Partial<Record<LogSource, string>> = {
  "edge-tts": "Edge",
  chatterbox: "Chatter",
  "web-speech": "WebSp.",
  sherpa: "Sherpa",
};

function averageByEngine(list: DecisionMatrixPoint[]): DecisionMatrixPoint[] {
  const groups = new Map<string, DecisionMatrixPoint[]>();
  for (const point of list) {
    const key = `${point.provider}|${point.badge ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }
  return [...groups.values()].map((group) => {
    if (group.length === 1) return group[0];
    const latest = [...group].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "")).at(-1)!;
    const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
    const timed = group.filter((p) => p.x > 0);
    return {
      ...latest,
      score: mean(group.map((p) => p.score)),
      x: timed.length > 0 ? mean(timed.map((p) => p.x)) : 0,
      direct: timed.length === 0,
      source: group.every((p) => p.source === "ai") ? "ai" : "manual",
      count: group.length,
      title: `Moyenne de ${group.length} essais`,
      subtitle: `Dernier : ${latest.title}`,
    };
  });
}

const isPlottable = (p: DecisionMatrixPoint) => p.score > 0 && (p.x > 0 || p.direct === true);

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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const WIDTH = width;
  const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
  const X_TICKS = width < 480 ? 3 : 4;
  // ANCHOR: un point par moteur (ou par couple, via `badge`) : moyenne des notes et de la vitesse de ses essais.
  // L'id et la date restent ceux de l'essai le plus récent, pour que le clic réécoute celui-là.
  const unrated = points.filter((p) => !(p.score > 0)).length;
  const untimed = points.filter((p) => p.score > 0 && !isPlottable(p)).length;
  const rated = averageByEngine(points.filter((p) => isPlottable(p)));
  const maxX = Math.max(minXDomain, ...rated.map((p) => p.x)) * 1.12;
  const hasDirect = rated.some((p) => p.direct);
  const providersShown = [...new Set(rated.flatMap((p) => (p.altProvider ? [p.altProvider, p.provider] : [p.provider])))];
  // NOTE: un couple de moteurs = un dégradé du moteur secondaire (gauche) vers le principal (droite).
  const pairs = [...new Map(rated.filter((p) => p.altProvider).map((p) => [`${p.altProvider}|${p.provider}`, p])).values()];
  const pairId = (p: DecisionMatrixPoint) => `pair-${p.altProvider}-${p.provider}`;
  const paint = (p: DecisionMatrixPoint) => (p.altProvider ? `url(#${pairId(p)})` : providerColorVar(p.provider));

  // NOTE: échelle en racine carrée, sinon un seul essai lent (ex. Chatterbox sur CPU) tasse tous les autres à gauche.
  const toX = (value: number) => PADDING.left + Math.sqrt(Math.max(value, 0) / maxX) * PLOT_WIDTH;
  const toY = (score: number) => PADDING.top + PLOT_HEIGHT - ((score - 0.5) / 3) * PLOT_HEIGHT;

  // ANCHOR: points superposés (moins de 9 px d'écart) = une grappe. Le plus récent est dessiné en dernier, donc au premier plan.
  // Les badges d'une grappe s'empilent comme des calques (le plus récent devant, ×n), et le survol liste tous les essais.
  const byAge = [...rated].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  const clusters: DecisionMatrixPoint[][] = [];
  for (const point of byAge) {
    const home = clusters.find((c) => Math.hypot(toX(c[0].x) - toX(point.x), toY(c[0].score) - toY(point.score)) < 9);
    if (home) home.push(point);
    else clusters.push([point]);
  }
  const hoveredCluster = hovered ? (clusters.find((c) => c.some((p) => p.id === hovered.id)) ?? [hovered]) : [];

  // ANCHOR: placement des badges sans collision. Les grappes les mieux notées (puis les plus rapides) choisissent en premier
  // leur emplacement parmi des candidats autour du point ; chaque pile évite les points et les piles déjà posés.
  type Box = { x: number; y: number; w: number; h: number };
  const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + 2) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + 2);
  const dots: Box[] = rated.map((p) => ({ x: toX(p.x) - 8, y: toY(p.score) - 8, w: 16, h: 16 }));
  const placed: Box[] = [];
  const badges = [...clusters]
    .sort((a, b) => b[b.length - 1].score - a[a.length - 1].score || a[0].x - b[0].x)
    .map((members) => {
      const point = members[members.length - 1];
      const baseLabel = point.badge ?? shortProviderLabel(point.provider);
      const total = members.reduce((sum, m) => sum + (m.count ?? 1), 0);
      const label = total > 1 ? `${baseLabel} ×${total}` : baseLabel;
      const peek = Math.min(members.length - 1, 3);
      const bw = label.length * 6 + 10;
      const w = bw + peek * LAYER_STEP;
      const h = BADGE_H + peek * LAYER_STEP;
      const cx = toX(point.x);
      const cy = toY(point.score);
      const candidates: { x: number; y: number }[] = [];
      for (const d of [0, 12, 24]) {
        candidates.push(
          { x: cx + 10, y: cy - h / 2 + d },
          { x: cx - 10 - w, y: cy - h / 2 + d },
          { x: cx + 10, y: cy - h / 2 - d },
          { x: cx - 10 - w, y: cy - h / 2 - d },
          { x: cx - w / 2, y: cy - h - 10 - d },
          { x: cx - w / 2, y: cy + 10 + d },
        );
      }
      let best: Box = { x: candidates[0].x, y: candidates[0].y, w, h };
      let bestCost = Infinity;
      let bestIndex = 0;
      candidates.forEach((c, index) => {
        const box: Box = {
          x: Math.max(2, Math.min(WIDTH - w - 2, c.x)),
          y: Math.max(2, Math.min(PADDING.top + PLOT_HEIGHT - h, c.y)),
          w,
          h,
        };
        const cost = placed.reduce((sum, b) => sum + overlap(box, b), 0) + dots.reduce((sum, b) => sum + overlap(box, b), 0) * 2 + index * 0.01;
        if (cost < bestCost) {
          bestCost = cost;
          best = box;
          bestIndex = index;
        }
      });
      placed.push(best);
      return { point, members, label, peek, bw, x: best.x, y: best.y, w, h, cx, cy, moved: bestIndex >= 6 };
    });

  return (
    <div>
      <div ref={containerRef} className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT} className="block max-w-full" role="img" aria-label={`Matrice de décision : note en fonction de ${xLabel.toLowerCase()}`}>
          {/* ANCHOR: zone acceptable = au-dessus de 2★ et dans la moitié gauche de l'axe (rapide). Le cadre la délimite, le dégradé (vert vers transparent) renforce la lecture : intensité proportionnelle à (note − 2, plafonnée à 1) × (1 − vitesse / limite de la zone). */}
          <defs>
            {pairs.map((p) => (
              <linearGradient key={pairId(p)} id={pairId(p)} gradientUnits="objectBoundingBox" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor={providerColorVar(p.altProvider!)} />
                <stop offset="1" stopColor={providerColorVar(p.provider)} />
              </linearGradient>
            ))}
            <linearGradient id="matrix-speed" x1="0" x2="1" y1="0" y2="0">
              {Array.from({ length: 11 }, (_, i) => (
                // NOTE: axe X en racine carrée, la limite de la zone est à u = 0,5 : x / limite = (position dans la zone)².
                <stop key={i} offset={i / 10} stopColor="var(--success)" stopOpacity={0.5 * (1 - (i / 10) ** 2)} />
              ))}
            </linearGradient>
            <linearGradient id="matrix-score" x1="0" x2="0" y1="0" y2="1">
              {Array.from({ length: 11 }, (_, i) => {
                // NOTE: de 3,5 (haut du graphique) à 2 (bas de la zone) : note = 3,5 − 1,5 w.
                const gray = Math.round(255 * Math.max(0, Math.min(1, 1.5 - 1.5 * (i / 10))));
                return <stop key={i} offset={i / 10} stopColor={`rgb(${gray},${gray},${gray})`} />;
              })}
            </linearGradient>
            <mask id="matrix-score-mask" maskContentUnits="objectBoundingBox">
              <rect width="1" height="1" fill="url(#matrix-score)" />
            </mask>
          </defs>
          <rect x={PADDING.left} y={PADDING.top} width={PLOT_WIDTH / 2} height={toY(2) - PADDING.top} fill="none" stroke="var(--success)" strokeOpacity={0.35} strokeDasharray="4 3" rx={4} />
          <rect x={PADDING.left} y={PADDING.top} width={PLOT_WIDTH / 2} height={toY(2) - PADDING.top} fill="url(#matrix-speed)" mask="url(#matrix-score-mask)" rx={4} />

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
            const value = maxX * (i / X_TICKS) ** 2;
            if (i === 0 && hasDirect) return null;
            return (
              <text key={i} x={toX(value)} y={PADDING.top + PLOT_HEIGHT + 16} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
                {formatX(value)}
              </text>
            );
          })}
          {hasDirect && (
            <text x={PADDING.left} y={PADDING.top + PLOT_HEIGHT + 16} textAnchor="start" fontSize={10} fill="var(--text-muted)">
              direct
            </text>
          )}
          <text x={PADDING.left + PLOT_WIDTH} y={HEIGHT - 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">
            {xLabel}, échelle resserrée →
          </text>

          {/* NOTE: badge court du moteur à côté de chaque point, pour repérer les gagnants sans survol. */}
          {badges.map(({ point, members, label, peek, bw, x: bx, y: by, w: boxW, h: boxH, moved, cx, cy }) => {
            const color = paint(point);
            return (
              <g key={`badge-${point.id}`} className="pointer-events-none">
                {moved && <line x1={cx} y1={cy} x2={Math.max(bx, Math.min(bx + boxW, cx))} y2={by + boxH / 2} stroke={providerColorVar(point.provider)} strokeOpacity={0.5} />}
                {/* NOTE: calques : du plus ancien (derrière, décalé en haut à droite) au plus récent (devant). */}
                {Array.from({ length: peek + 1 }, (_, k) => {
                  const layer = members[members.length - 1 - (peek - k)];
                  const lx = bx + (peek - k) * LAYER_STEP;
                  const ly = by + k * LAYER_STEP;
                  const layerColor = paint(layer);
                  return (
                    <g key={layer.id}>
                      <rect x={lx} y={ly} width={bw} height={BADGE_H} rx={8} fill="var(--surface)" />
                      <rect x={lx} y={ly} width={bw} height={BADGE_H} rx={8} fill={layerColor} fillOpacity={0.16} stroke={layerColor} strokeOpacity={0.6} />
                    </g>
                  );
                })}
                <text x={bx + bw / 2} y={by + peek * LAYER_STEP + 11.5} textAnchor="middle" fontSize={9.5} fontWeight={600} fill="var(--text)">
                  {label}
                </text>
              </g>
            );
          })}

          {byAge.map((point) => {
            const isHovered = hovered?.id === point.id;
            return (
              <circle
                key={point.id}
                cx={toX(point.x)}
                cy={toY(point.score)}
                r={isHovered ? 8 : 6}
                fill={point.source === "ai" ? "var(--surface)" : paint(point)}
                stroke={point.source === "ai" ? paint(point) : "var(--surface)"}
                strokeWidth={point.source === "ai" ? 2.5 : 2}
                tabIndex={onSelect ? 0 : -1}
                role={onSelect ? "button" : undefined}
                aria-label={`${point.title}, ${LOG_SOURCE_LABELS[point.provider]}, ${Number.isInteger(point.score) ? point.score : point.score.toFixed(1)} sur 3, ${point.direct ? "direct" : formatX(point.x)}`}
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

        {/* NOTE: sans point noté, la matrice reste affichée (axes et zone à viser) avec la consigne par-dessus. */}
        {rated.length === 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-fit max-w-[80%] -translate-y-1/2 rounded-lg border border-dashed border-line bg-surface/90 px-3 py-2 text-center text-sm text-muted">
            {emptyMessage}
          </p>
        )}

        {hovered && (
          <div
            className="pointer-events-none absolute z-10 max-w-[240px] -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
            style={{ left: `${(toX(hovered.x) / WIDTH) * 100}%`, top: `calc(${(toY(hovered.score) / HEIGHT) * 100}% - 12px)` }}
          >
            {hoveredCluster.length > 1 ? (
              <>
                <p className="font-semibold text-ink">{hoveredCluster.length} essais superposés</p>
                <ul className="mt-1 space-y-0.5">
                  {[...hoveredCluster].reverse().slice(0, 6).map((p) => (
                    <li key={p.id} className="flex items-center gap-1.5 text-muted">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: p.altProvider ? `linear-gradient(to right, ${providerColorVar(p.altProvider)}, ${providerColorVar(p.provider)})` : providerColorVar(p.provider) }} />
                      <span className="truncate">
                        <span className="font-medium text-ink">{p.badge ?? shortProviderLabel(p.provider)}</span>, {p.title}
                      </span>
                    </li>
                  ))}
                </ul>
                {hoveredCluster.length > 6 && <p className="mt-1 text-muted">+ {hoveredCluster.length - 6} autres</p>}
                <p className="mt-1 text-muted">
                  {Number.isInteger(hovered.score) ? hovered.score : hovered.score.toFixed(1)}/3, {hovered.direct ? "direct" : formatX(hovered.x)}
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-ink">{hovered.title}</p>
                <p className="text-muted">
                  {LOG_SOURCE_LABELS[hovered.provider]}, {Number.isInteger(hovered.score) ? hovered.score : hovered.score.toFixed(1)}/3, {hovered.direct ? "direct" : formatX(hovered.x)}
                </p>
                {hovered.subtitle && <p className="mt-1 line-clamp-2 text-muted">{hovered.subtitle}</p>}
              </>
            )}
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
        {(unrated > 0 || untimed > 0) && (
          <li className="text-warning">
            Non placés : {[unrated > 0 && `${unrated} sans note`, untimed > 0 && `${untimed} sans temps mesuré`].filter(Boolean).join(", ")}
          </li>
        )}
        {rated.some((p) => p.source === "ai") && <li>Anneau : note IA, plein : note manuelle</li>}
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-8 rounded-sm" style={{ background: "linear-gradient(to right, color-mix(in srgb, var(--success) 45%, transparent), transparent)" }} />
          Plus c'est vert, meilleur
        </li>
        {onSelect && <li className="ml-auto">Un point par moteur, moyenne de ses essais. Clic : réécouter le dernier.</li>}
      </ul>
    </div>
  );
}
