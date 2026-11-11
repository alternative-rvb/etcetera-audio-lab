"use client";

import { Check, RefreshCw, TriangleAlert } from "lucide-react";
import type { TtsVoice, TtsVoiceList } from "@/lib/shared/types";
import { Skeleton } from "@/components/ui/panel";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/client/cn";

// SECTION: Grille des voix du provider sélectionné.

const GENDER_LABELS: Record<TtsVoice["gender"], string> = { female: "Femme", male: "Homme", unknown: "Neutre" };

export function TtsVoicePicker({
  voiceList,
  loading,
  error,
  selectedVoiceId,
  onSelect,
  onRetry,
  emptyHint,
}: {
  voiceList: TtsVoiceList | null;
  loading: boolean;
  error: string | null;
  selectedVoiceId: string | null;
  onSelect: (voiceId: string) => void;
  onRetry: () => void;
  emptyHint: string;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[58px]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
        <span>Voix indisponibles : {error}</span>
        <IconButton label="Réessayer" onClick={onRetry}>
          <RefreshCw size={14} />
        </IconButton>
      </div>
    );
  }

  const voices = voiceList?.voices ?? [];
  return (
    <div className="space-y-2">
      {voiceList?.degraded && (
        <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          {voiceList.degradedReason ?? "Liste de voix de secours : le service n'a pas répondu."}
        </p>
      )}
      {voices.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-muted">{emptyHint}</p>
      ) : (
        <div role="radiogroup" aria-label="Voix" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {voices.map((voice) => {
            const active = voice.id === selectedVoiceId;
            return (
              <button
                key={voice.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSelect(voice.id)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition",
                  active ? "border-[var(--provider)] bg-[color-mix(in_srgb,var(--provider)_8%,transparent)]" : "border-line hover:border-line-strong"
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-ink">{voice.name}</span>
                  {active && <Check size={14} className="shrink-0 text-[var(--provider)]" />}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted">
                  {[GENDER_LABELS[voice.gender], voice.language, voice.quality].filter(Boolean).join(" · ")}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
