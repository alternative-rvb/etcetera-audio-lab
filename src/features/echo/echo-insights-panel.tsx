"use client";

import { STT_PROVIDER_CATALOG, TTS_PROVIDER_CATALOG } from "@/lib/shared/provider-catalog";
import { formatSeconds } from "@/lib/client/format";
import { cn } from "@/lib/client/cn";
import { CollapsiblePanel } from "@/components/ui/collapsible-panel";
import { Icon } from "@/components/ui/icon";
import { DecisionMatrixChart } from "@/components/shared/decision-matrix-chart";
import { averageOf, StatTiles } from "@/components/shared/stat-tiles";
import type { EchoRound } from "./echo-types";

// SECTION: Comparatif de l'écho : moyennes du couple choisi, matrice note / temps et tableau par couple STT + TTS.

type Couple = Pick<EchoRound, "sttProvider" | "ttsProvider">;

export const coupleKey = (round: Couple) => `${round.sttProvider}+${round.ttsProvider}`;
export const coupleLabel = (round: Couple) =>
  `${STT_PROVIDER_CATALOG[round.sttProvider]?.label ?? round.sttProvider} + ${TTS_PROVIDER_CATALOG[round.ttsProvider]?.label ?? round.ttsProvider}`;

/** Latence perçue sans la pause volontaire : ce que coûtent réellement les moteurs. */
export const engineLatency = (round: EchoRound) => round.times.latencyMs - round.times.delayMs;

function formatAverage(values: number[]): string {
  const average = averageOf(values);
  return average === null ? "-" : formatSeconds(average);
}

export function EchoInsightsPanel({ rounds, current, onSelect }: { rounds: EchoRound[]; current: Couple; onSelect: (id: string) => void }) {
  const currentRounds = rounds.filter((round) => coupleKey(round) === coupleKey(current));
  const rated = rounds.filter((round) => round.score > 0);
  const averageScore = averageOf(currentRounds.filter((round) => round.score > 0).map((round) => round.score));

  // NOTE: un couple par ligne, trié du plus rapide au plus lent sur la latence hors pause.
  const couples = [...new Map(rounds.map((round) => [coupleKey(round), round])).values()]
    .map((sample) => {
      const items = rounds.filter((round) => coupleKey(round) === coupleKey(sample));
      const scored = items.filter((round) => round.score > 0);
      return {
        key: coupleKey(sample),
        label: coupleLabel(sample),
        count: items.length,
        score: averageOf(scored.map((round) => round.score)),
        engine: averageOf(items.map(engineLatency)) ?? 0,
        stt: averageOf(items.map((round) => round.times.sttMs)) ?? 0,
        tts: averageOf(items.map((round) => round.times.ttsMs)) ?? 0,
        total: averageOf(items.map((round) => round.times.totalMs)) ?? 0,
      };
    })
    .sort((a, b) => a.engine - b.engine);

  return (
    <CollapsiblePanel
      storageKey="echo-insights"
      title="Comparatif"
      summary={rated.length === 0 ? "Notez une réponse pour comparer" : `${rounds.length} tour${rounds.length > 1 ? "s" : ""}, ${rated.length} noté${rated.length > 1 ? "s" : ""}`}
    >
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Couple choisi: <span className="font-medium text-ink">{coupleLabel(current)}</span>, {currentRounds.length} tour{currentRounds.length > 1 ? "s" : ""}
        </p>
        <StatTiles
          tiles={[
            { label: "Note moyenne", value: averageScore === null ? "-" : `${averageScore.toFixed(1)}★` },
            {
              label: "Latence moteurs",
              value: formatAverage(currentRounds.map(engineLatency)),
              hint: "Fin de votre phrase jusqu'au début de la réponse, pause volontaire retirée (détection du silence comprise).",
            },
            { label: "Transcription", value: formatAverage(currentRounds.map((round) => round.times.sttMs)), hint: "Arrêt de l'écoute jusqu'au texte reçu, mesuré dans le navigateur." },
            { label: "Synthèse", value: formatAverage(currentRounds.map((round) => round.times.ttsMs)), hint: "Envoi du texte jusqu'à l'audio prêt, mesuré dans le navigateur." },
            {
              label: "Temps total",
              value: formatAverage(currentRounds.map((round) => round.times.totalMs)),
              hint: "Tour complet : début de l'écoute jusqu'à la fin de la lecture de la réponse (parole, transcription, pause, synthèse et lecture).",
            },
          ]}
        />

        {/* ANCHOR: même matrice que les pages Synthèse et Transcription ; couleur du point = moteur TTS, couple complet dans l'infobulle. */}
        <DecisionMatrixChart
          points={rounds.map((round) => ({
            id: round.id,
            provider: round.ttsProvider,
            score: round.score ?? 0,
            x: Math.max(1, engineLatency(round)),
            title: `${coupleLabel(round)}, ${round.voiceName}`,
            subtitle: round.text,
          }))}
          xLabel="Latence moteurs"
          formatX={(ms) => `${(ms / 1000).toFixed(1)} s`}
          minXDomain={3000}
          onSelect={onSelect}
          emptyMessage="Notez les réponses de 1 à 3 étoiles, juste après chaque tour ou dans la liste des mesures, pour les placer sur la matrice."
        />

        {couples.length > 1 && (
          <section aria-label="Comparatif par couple" className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-1 pr-3 font-normal">Couple STT + TTS</th>
                  <th className="py-1 pr-3 text-right font-normal">Tours</th>
                  <th className="py-1 pr-3 text-right font-normal">Note</th>
                  <th className="py-1 pr-3 text-right font-normal">Latence moteurs</th>
                  <th className="py-1 pr-3 text-right font-normal">STT</th>
                  <th className="py-1 pr-3 text-right font-normal">TTS</th>
                  <th className="py-1 text-right font-normal">Total</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {couples.map((couple, index) => (
                  <tr key={couple.key} className={cn("border-t border-line", couple.key === coupleKey(current) && "font-medium text-ink")}>
                    <td className="py-1.5 pr-3">
                      {index === 0 && <Icon name="star" size={14} className="mr-1 inline text-accent" />}
                      {couple.label}
                    </td>
                    <td className="py-1.5 pr-3 text-right">{couple.count}</td>
                    <td className="py-1.5 pr-3 text-right">{couple.score === null ? "-" : `${couple.score.toFixed(1)}★`}</td>
                    <td className="py-1.5 pr-3 text-right">{formatSeconds(couple.engine)}</td>
                    <td className="py-1.5 pr-3 text-right">{formatSeconds(couple.stt)}</td>
                    <td className="py-1.5 pr-3 text-right">{formatSeconds(couple.tts)}</td>
                    <td className="py-1.5 text-right">{formatSeconds(couple.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </CollapsiblePanel>
  );
}
