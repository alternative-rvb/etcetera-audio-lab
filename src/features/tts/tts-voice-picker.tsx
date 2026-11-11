"use client";

import type { TtsVoice, TtsVoiceList } from "@/lib/shared/types";
import { Skeleton } from "@/components/ui/panel";
import { IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/client/cn";

// SECTION: Grille des voix du provider sélectionné.

const GENDER_LABELS: Record<TtsVoice["gender"], string> = { female: "Femme", male: "Homme", unknown: "Neutre" };
const LANGUAGE_LABELS: Record<string, string> = { "fr-FR": "français", "en-US": "anglais US", "en-GB": "anglais UK", "es-ES": "espagnol", "de-DE": "allemand" };
// NOTE: niveaux de qualité des voix Piper ; les autres moteurs fournissent déjà un libellé lisible.
const QUALITY_LABELS: Record<string, string> = { x_low: "qualité très basse", low: "qualité basse", medium: "qualité moyenne", high: "qualité haute" };

/** Description lisible d'une voix ; la langue n'apparaît que si la liste en mélange plusieurs. */
function describeVoice(voice: TtsVoice, showLanguage: boolean): string {
  return [GENDER_LABELS[voice.gender], showLanguage ? (LANGUAGE_LABELS[voice.language] ?? voice.language) : null, QUALITY_LABELS[voice.quality] ?? voice.quality]
    .filter(Boolean)
    .join(", ");
}

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
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
        <span>Voix indisponibles : {error}</span>
        <IconButton label="Recharger les voix" onClick={onRetry}>
          <Icon name="refresh" />
        </IconButton>
      </div>
    );
  }

  const voices = voiceList?.voices ?? [];
  const showLanguage = new Set(voices.map((v) => v.language)).size > 1;
  return (
    <div className="space-y-2">
      {voiceList?.degraded && (
        <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
          <Icon name="warning" size={16} className="mt-px" />
          {voiceList.degradedReason ?? "Liste de voix de secours : le service n'a pas répondu."}
        </p>
      )}
      {voices.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-muted">{emptyHint}</p>
      ) : (
        <div role="radiogroup" aria-label="Voix" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
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
                  "min-w-0 rounded-lg border px-2.5 py-1.5 text-left transition",
                  active ? "border-[var(--provider)] bg-[color-mix(in_srgb,var(--provider)_8%,transparent)]" : "border-line hover:border-line-strong"
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-ink">{voice.name}</span>
                  {active && <Icon name="check" size={16} className="text-[var(--provider)]" />}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted">
                  {describeVoice(voice, showLanguage)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
