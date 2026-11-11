"use client";

import { ChartScatter } from "lucide-react";
import type { SttHistoryEntry } from "@/lib/shared/types";
import { CollapsiblePanel } from "@/components/ui/collapsible-panel";
import { DecisionMatrixChart } from "@/components/shared/decision-matrix-chart";
import { averageOf, StatTiles } from "@/components/shared/stat-tiles";

// SECTION: Statistiques et matrice de décision STT (note en fonction du RTF).
// NOTE: Web Speech n'a pas de RTF mesurable (traitement dans le navigateur), il n'apparaît pas sur la matrice.

export function SttInsightsPanel({ items, onSelect }: { items: SttHistoryEntry[]; onSelect: (id: string) => void }) {
  const rated = items.filter((i) => i.score > 0);
  const averageScore = averageOf(rated.map((i) => i.score));
  const averageRtf = averageOf(items.filter((i) => i.rtf > 0).map((i) => i.rtf));

  return (
    <CollapsiblePanel
      storageKey="stt-insights"
      icon={<ChartScatter size={16} />}
      title="Comparatif"
      summary={`${items.length} transcription${items.length > 1 ? "s" : ""}, ${rated.length} notée${rated.length > 1 ? "s" : ""}`}
    >
      <div className="space-y-4">
        <StatTiles
          tiles={[
            { label: "Transcriptions", value: items.length },
            { label: "Note moyenne", value: averageScore === null ? "-" : `${averageScore.toFixed(1)}★` },
            { label: "RTF moyen", value: averageRtf === null ? "-" : `${averageRtf.toFixed(3)}×`, hint: "En dessous de 1, plus rapide que le temps réel." },
            { label: "Favoris", value: items.filter((i) => i.isFavorite).length },
          ]}
        />
        <DecisionMatrixChart
          points={items.map((item) => ({
            id: item.id,
            provider: item.provider,
            score: item.score,
            x: item.rtf,
            title: `${item.modelSize} · ${item.device}`,
            subtitle: item.text,
          }))}
          xLabel="RTF"
          formatX={(rtf) => `${rtf.toFixed(2)}×`}
          minXDomain={0.5}
          onSelect={onSelect}
          emptyMessage="Notez des transcriptions Whisper ou Sherpa de 1 à 3 étoiles pour les placer sur la matrice."
        />
      </div>
    </CollapsiblePanel>
  );
}
