"use client";

import { useRef } from "react";
import { STT_PROVIDER_CATALOG, TTS_PROVIDER_CATALOG } from "@/lib/shared/provider-catalog";
import { formatClock, formatSeconds } from "@/lib/client/format";
import { cn } from "@/lib/client/cn";
import { Button, IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Panel } from "@/components/ui/panel";
import { ProviderBadge } from "@/components/ui/provider-badge";
import { StarRating } from "@/components/ui/feedback-controls";
import { DecisionMatrixChart } from "@/components/shared/decision-matrix-chart";
import { averageOf, StatTiles } from "@/components/shared/stat-tiles";
import type { EchoRound } from "./echo-types";

// SECTION: Mesures de l'écho : moyennes du couple STT + TTS choisi, comparatif par couple et liste des tours.

const coupleKey = (round: Pick<EchoRound, "sttProvider" | "ttsProvider">) => `${round.sttProvider}+${round.ttsProvider}`;
const coupleLabel = (round: Pick<EchoRound, "sttProvider" | "ttsProvider">) =>
  `${STT_PROVIDER_CATALOG[round.sttProvider]?.label ?? round.sttProvider} + ${TTS_PROVIDER_CATALOG[round.ttsProvider]?.label ?? round.ttsProvider}`;

/** Latence perçue sans la pause volontaire : ce que coûtent réellement les moteurs. */
const engineLatency = (round: EchoRound) => round.times.latencyMs - round.times.delayMs;

function formatAverage(values: number[]): string {
  const average = averageOf(values);
  return average === null ? "–" : formatSeconds(average);
}

export function EchoRoundsPanel({
  rounds,
  current,
  onClear,
  onScore,
}: {
  rounds: EchoRound[];
  current: Pick<EchoRound, "sttProvider" | "ttsProvider">;
  onClear: () => void;
  onScore: (id: string, score: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentRounds = rounds.filter((round) => coupleKey(round) === coupleKey(current));

  // NOTE: un couple par ligne, trié du plus rapide au plus lent sur la latence hors pause.
  const couples = [...new Map(rounds.map((round) => [coupleKey(round), round])).values()]
    .map((sample) => {
      const items = rounds.filter((round) => coupleKey(round) === coupleKey(sample));
      return {
        key: coupleKey(sample),
        label: coupleLabel(sample),
        count: items.length,
        engine: averageOf(items.map(engineLatency)) ?? 0,
        stt: averageOf(items.map((round) => round.times.sttMs)) ?? 0,
        tts: averageOf(items.map((round) => round.times.ttsMs)) ?? 0,
        total: averageOf(items.map((round) => round.times.totalMs)) ?? 0,
      };
    })
    .sort((a, b) => a.engine - b.engine);

  const replay = (url: string) => {
    audioRef.current?.pause();
    audioRef.current = new Audio(url);
    void audioRef.current.play();
  };

  return (
    <Panel
      title="Mesures"
      meta={rounds.length ? `${rounds.length} tour${rounds.length > 1 ? "s" : ""}` : undefined}
      bodyClassName="space-y-4"
      actions={
        rounds.length > 0 && (
          <Button variant="ghost" size="sm" icon={<Icon name="delete" />} onClick={onClear}>
            Effacer
          </Button>
        )
      }
    >
      <section aria-label="Moyennes du couple choisi" className="space-y-2">
        <p className="text-sm text-muted">
          Couple choisi: <span className="font-medium text-ink">{coupleLabel(current)}</span>, {currentRounds.length} tour{currentRounds.length > 1 ? "s" : ""}
        </p>
        <StatTiles
          tiles={[
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
      </section>

      {/* ANCHOR: même matrice que les pages Synthèse et Transcription ; couleur du point = moteur TTS, couple complet dans l'infobulle. */}
      {rounds.length > 0 && (
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
          onSelect={(id) => {
            const round = rounds.find((item) => item.id === id);
            if (round) replay(round.audioUrl);
          }}
          emptyMessage="Notez des réponses de 1 à 3 étoiles pour placer les couples sur la matrice."
        />
      )}

      {couples.length > 1 && (
        <section aria-label="Comparatif par couple" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-1 pr-3 font-normal">Couple STT + TTS</th>
                <th className="py-1 pr-3 text-right font-normal">Tours</th>
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

      {rounds.length === 0 ? (
        <p className="text-sm text-muted">Aucun tour pour l&apos;instant. Lancez l&apos;écho et dites une phrase: les temps de chaque étape s&apos;afficheront ici.</p>
      ) : (
        <ol aria-label="Derniers tours" className="divide-y divide-line">
          {rounds.map((round) => (
            <li key={round.id} className="flex items-start gap-3 py-2.5">
              <IconButton label="Réécouter la réponse" onClick={() => replay(round.audioUrl)}>
                <Icon name="play" />
              </IconButton>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 text-sm text-ink">{round.text}</p>
                  <StarRating value={round.score ?? 0} onChange={(score) => onScore(round.id, score === round.score ? 0 : score)} label="Note de la réponse" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <ProviderBadge provider={round.sttProvider} />
                  <ProviderBadge provider={round.ttsProvider}>
                    {TTS_PROVIDER_CATALOG[round.ttsProvider]?.label ?? round.ttsProvider}, {round.voiceName}
                  </ProviderBadge>
                  {round.fallback && <span className="text-warning">secours utilisé</span>}
                  <span className="tabular-nums">
                    STT {formatSeconds(round.times.sttMs)}, pause {formatSeconds(round.times.delayMs, 1)}, TTS {formatSeconds(round.times.ttsMs)}, réponse après {formatSeconds(round.times.latencyMs)}, total{" "}
                    <span className="font-medium text-ink">{formatSeconds(round.times.totalMs ?? 0)}</span>
                  </span>
                  <span className="ml-auto">{formatClock(round.createdAt)}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
