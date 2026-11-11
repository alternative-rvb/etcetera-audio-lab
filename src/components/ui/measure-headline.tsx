"use client";

import type { RuntimeTrace } from "@/lib/shared/types";
import { RuntimeBadge } from "@/components/ui/runtime-badge";
import { StarRating } from "@/components/ui/feedback-controls";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/client/cn";

// SECTION: Bandeau des deux mesures du banc d'essai, mises en avant en tête du résultat : temps d'exécution et qualité perçue.

/** Nombre minimal d'essais précédents du même moteur pour afficher une comparaison qui ait du sens. */
const MIN_PEERS = 3;

export interface PeerComparison {
  /** Médiane du coût des essais précédents divisée par le coût de celui-ci : au-dessus de 1, plus rapide que d'habitude. */
  ratio: number;
  count: number;
  providerLabel: string;
  /** Sur quoi porte la comparaison, pour l'infobulle (ex. « temps par caractère »). */
  basis: string;
}

/** Compare un coût (temps par caractère, RTF) à la médiane des essais précédents du même moteur. */
export function compareToPeers(cost: number, peerCosts: number[], providerLabel: string, basis: string): PeerComparison | undefined {
  const valid = peerCosts.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (cost <= 0 || valid.length < MIN_PEERS) return undefined;
  const middle = Math.floor(valid.length / 2);
  const median = valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
  return { ratio: median / cost, count: valid.length, providerLabel, basis };
}

function formatFactor(factor: number): string {
  return factor >= 10 ? factor.toFixed(0) : factor.toFixed(1).replace(".", ",");
}

function formatBigSeconds(ms: number): string {
  const seconds = ms / 1000;
  return (seconds >= 10 ? seconds.toFixed(1) : seconds.toFixed(2)).replace(".", ",");
}

function RealtimeFactor({ factor }: { factor: number }) {
  if (factor >= 1) return <span>{formatFactor(factor)}× plus vite que le temps réel</span>;
  return <span className="text-warning">{formatFactor(1 / factor)}× plus lent que le temps réel</span>;
}

function PeerLine({ comparison }: { comparison: PeerComparison }) {
  const { ratio, count, providerLabel, basis } = comparison;
  // NOTE: à ±15 % de la médiane, l'écart relève du bruit de mesure.
  const label =
    ratio > 1.15
      ? `${formatFactor(ratio)}× plus rapide que d'habitude`
      : ratio < 1 / 1.15
        ? `${formatFactor(1 / ratio)}× plus lent que d'habitude`
        : "Dans la moyenne habituelle";
  return (
    <Tooltip label={`Comparé à la médiane des ${count} essais précédents de ${providerLabel} (${basis}).`} describe>
      <span
        tabIndex={0}
        className={cn("cursor-help underline decoration-dotted underline-offset-2", ratio > 1.15 ? "text-success" : ratio < 1 / 1.15 ? "text-warning" : "text-muted")}
      >
        {label}
      </span>
    </Tooltip>
  );
}

export function MeasureHeadline({
  timeLabel,
  timeMs,
  realtimeFactor,
  realtimeDetail,
  comparison,
  trace,
  score,
  onScore,
}: {
  timeLabel: string;
  /** Temps d'exécution ; 0 ou absent pour un traitement en direct (Web Speech). */
  timeMs?: number;
  /** Durée de l'audio divisée par le temps d'exécution. */
  realtimeFactor?: number;
  /** Précision affichée en infobulle sur la vitesse (ex. RTF exact). */
  realtimeDetail?: string;
  comparison?: PeerComparison;
  trace: RuntimeTrace;
  score: number;
  onScore: (score: number) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-line px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-muted">{timeLabel}</p>
        <p className="font-semibold leading-tight text-ink tabular-nums">
          {timeMs ? (
            <>
              <span className="text-3xl">{formatBigSeconds(timeMs)}</span>
              <span className="ml-0.5 text-base text-muted">s</span>
            </>
          ) : (
            <span className="text-2xl">En direct</span>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted">
          {realtimeFactor !== undefined && realtimeFactor > 0 && (
            realtimeDetail ? (
              <Tooltip label={realtimeDetail} describe>
                <span tabIndex={0} className="cursor-help">
                  <RealtimeFactor factor={realtimeFactor} />
                </span>
              </Tooltip>
            ) : (
              <RealtimeFactor factor={realtimeFactor} />
            )
          )}
          {comparison && <PeerLine comparison={comparison} />}
          <RuntimeBadge trace={trace} />
        </p>
      </div>

      <div className="flex flex-col items-end">
        <p className="text-xs text-muted">Qualité perçue</p>
        <StarRating value={score} size={24} label="Qualité perçue" onChange={onScore} />
        <p className="text-xs text-muted">{score ? `${score} sur 3` : "À noter à l'écoute"}</p>
      </div>
    </div>
  );
}
