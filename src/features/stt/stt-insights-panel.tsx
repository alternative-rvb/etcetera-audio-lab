"use client";

import { useState } from "react";
import type { SttHistoryEntry } from "@/lib/shared/types";
import { CollapsiblePanel } from "@/components/ui/collapsible-panel";
import { DecisionMatrixChart } from "@/components/shared/decision-matrix-chart";
import { NoGpuFilter } from "@/components/ui/hardware-badge";
import { isVpsComparable, sttHardware } from "@/lib/shared/hardware";
import { averageOf, StatTiles } from "@/components/shared/stat-tiles";

// SECTION: Statistiques et matrice de décision STT (note en fonction du RTF).
// NOTE: Web Speech n'a pas de RTF mesurable (traitement dans le navigateur), il n'apparaît pas sur la matrice.

export function SttInsightsPanel({ items: allItems, onSelect }: { items: SttHistoryEntry[]; onSelect: (id: string) => void }) {
  // NOTE: filtre actif par défaut, le banc d'essai vise un VPS sans GPU.
  const [noGpu, setNoGpu] = useState(true);
  const items = noGpu ? allItems.filter((i) => isVpsComparable(sttHardware(i))) : allItems;
  const rated = items.filter((i) => i.score > 0);
  const averageScore = averageOf(rated.map((i) => i.score));
  const averageRtf = averageOf(items.filter((i) => i.rtf > 0).map((i) => i.rtf));

  return (
    <CollapsiblePanel
      storageKey="stt-insights"
      title="Comparatif"
      disabled={rated.length === 0}
      summary={rated.length === 0 ? "Notez une transcription pour comparer" : `${items.length} transcription${items.length > 1 ? "s" : ""}, ${rated.length} notée${rated.length > 1 ? "s" : ""}`}
    >
      <div className="space-y-3">
        <NoGpuFilter active={noGpu} onChange={setNoGpu} hiddenCount={allItems.length - items.length} />
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
            title: `${item.modelSize}, ${item.device.toUpperCase()}`,
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
