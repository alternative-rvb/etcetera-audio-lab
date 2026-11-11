"use client";

import { useState } from "react";
import type { TtsHistoryEntry } from "@/lib/shared/types";
import { CollapsiblePanel } from "@/components/ui/collapsible-panel";
import { DecisionMatrixChart } from "@/components/shared/decision-matrix-chart";
import { NoGpuFilter } from "@/components/ui/hardware-badge";
import { isVpsComparable, ttsHardware } from "@/lib/shared/hardware";
import { averageOf, StatTiles } from "@/components/shared/stat-tiles";

// SECTION: Statistiques et matrice de décision TTS (note en fonction du temps de génération).

export function TtsInsightsPanel({ items: allItems, onSelect }: { items: TtsHistoryEntry[]; onSelect: (id: string) => void }) {
  // NOTE: filtre actif par défaut, le banc d'essai vise un VPS sans GPU.
  const [noGpu, setNoGpu] = useState(true);
  const items = noGpu ? allItems.filter((i) => isVpsComparable(ttsHardware(i))) : allItems;
  const rated = items.filter((i) => i.score > 0);
  const averageScore = averageOf(rated.map((i) => i.score));
  const averageTime = averageOf(items.filter((i) => i.generationTimeMs > 0).map((i) => i.generationTimeMs));

  return (
    <CollapsiblePanel
      storageKey="tts-insights"
      title="Comparatif"
      summary={rated.length === 0 ? "Notez un audio pour comparer" : `${items.length} audio${items.length > 1 ? "s" : ""}, ${rated.length} noté${rated.length > 1 ? "s" : ""}`}
    >
      <div className="space-y-3">
        <NoGpuFilter active={noGpu} onChange={setNoGpu} hiddenCount={allItems.length - items.length} />
        <StatTiles
          tiles={[
            { label: "Générations", value: items.length },
            { label: "Note moyenne", value: averageScore === null ? "-" : `${averageScore.toFixed(1)}★` },
            { label: "Temps moyen", value: averageTime === null ? "-" : `${(averageTime / 1000).toFixed(2)} s` },
            { label: "Favoris", value: items.filter((i) => i.isFavorite).length },
          ]}
        />
        <DecisionMatrixChart
          points={items.map((item) => ({
            id: item.id,
            provider: item.provider,
            score: item.score,
            x: item.generationTimeMs,
            title: item.voiceName,
            subtitle: item.text,
          }))}
          xLabel="Temps de génération"
          formatX={(ms) => `${(ms / 1000).toFixed(1)} s`}
          minXDomain={3000}
          onSelect={onSelect}
          emptyMessage="Notez des audios de 1 à 3 étoiles pour les placer sur la matrice."
        />
      </div>
    </CollapsiblePanel>
  );
}
