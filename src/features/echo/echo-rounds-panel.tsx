"use client";

import { TTS_PROVIDER_CATALOG } from "@/lib/shared/provider-catalog";
import { formatClock, formatSeconds } from "@/lib/client/format";
import { Button, IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Panel } from "@/components/ui/panel";
import { ProviderBadge } from "@/components/ui/provider-badge";
import { StarRating } from "@/components/ui/feedback-controls";
import { roundMode, type EchoRound } from "./echo-types";

// SECTION: Liste des mesures de l'écho, une ligne par tour, avec réécoute et note.

export function EchoRoundsPanel({
  rounds,
  onClear,
  onScore,
  onReplay,
}: {
  rounds: EchoRound[];
  onClear: () => void;
  onScore: (id: string, score: number) => void;
  onReplay: (url: string) => void;
}) {
  return (
    <Panel
      title="Mesures"
      meta={rounds.length ? `${rounds.length} mesure${rounds.length > 1 ? "s" : ""}` : undefined}
      bodyClassName="space-y-4"
      actions={
        rounds.length > 0 && (
          <Button variant="ghost" size="sm" icon={<Icon name="delete" />} onClick={onClear}>
            Effacer
          </Button>
        )
      }
    >
      {rounds.length === 0 ? (
        <p className="text-sm text-muted">Aucune mesure pour l&apos;instant. Lancez une mesure et dites une phrase: les temps de chaque étape s&apos;afficheront ici.</p>
      ) : (
        <ol aria-label="Mesures effectuées" className="max-h-[28rem] divide-y divide-line overflow-y-auto pr-1">
          {rounds.map((round, index) => (
            <li key={round.id} className="flex items-start gap-3 py-2.5">
              <IconButton label="Réécouter la réponse" onClick={() => onReplay(round.audioUrl)}>
                <Icon name="play" />
              </IconButton>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 text-sm text-ink">
                    {/* NOTE: liste du plus récent au plus ancien, la mesure 1 est la plus ancienne conservée. */}
                    <span className="mr-1.5 font-semibold tabular-nums">Mesure {rounds.length - index}</span>
                    {round.text}
                    {roundMode(round) === "ai" && round.reply && <span className="mt-0.5 block text-muted">→ {round.reply}</span>}
                  </p>
                  <StarRating value={round.score ?? 0} onChange={(score) => onScore(round.id, score === round.score ? 0 : score)} label="Note de la réponse" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <ProviderBadge provider={round.sttProvider} />
                  <ProviderBadge provider={round.ttsProvider} />
                  {round.voiceName && <span>voix {round.voiceName}</span>}
                  {roundMode(round) === "ai" && <ProviderBadge provider="groq">IA Groq</ProviderBadge>}
                  {round.fallback && <span className="text-warning">secours utilisé</span>}
                  <span className="tabular-nums">
                    STT {formatSeconds(round.times.sttMs)}, TTS {formatSeconds(round.times.ttsMs)}, traitement{" "}
                    <span className="font-medium text-ink">{formatSeconds(round.times.sttMs + round.times.ttsMs)}</span>
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
