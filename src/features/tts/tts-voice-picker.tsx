"use client";

import type { TtsVoice, TtsVoiceList } from "@/lib/shared/types";
import { Skeleton } from "@/components/ui/panel";
import { HintText } from "@/components/ui/hint-text";
import { IconButton } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/client/cn";

// SECTION: Grille des voix du provider sélectionné.

const GENDER_LABELS: Record<TtsVoice["gender"], string> = { female: "Femme", male: "Homme", unknown: "Neutre" };
const GENDER_ICONS: Partial<Record<TtsVoice["gender"], IconName>> = { female: "female", male: "male" };
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
  healthAlertShown = false,
  neutral = false,
}: {
  voiceList: TtsVoiceList | null;
  loading: boolean;
  error: string | null;
  selectedVoiceId: string | null;
  onSelect: (voiceId: string) => void;
  onRetry: () => void;
  emptyHint: string;
  /** L'alerte de santé du moteur est déjà affichée au-dessus : on ne répète pas la même cause ici. */
  healthAlertShown?: boolean;
  /** Bouton de voix sélectionné en style neutre, sans la couleur du moteur (page Écho). */
  neutral?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex gap-1.5">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
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
      {voiceList?.degraded && !healthAlertShown && (
        <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
          <Icon name="warning" size={16} className="mt-px" />
          <span><HintText text={voiceList.degradedReason ?? "Liste de voix de secours : le service n'a pas répondu."} /></span>
        </p>
      )}
      {voices.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-muted">{emptyHint}</p>
      ) : (
        // NOTE: puces sur une ligne (icône de genre, nom, icône multilingue) ; la description complète passe en infobulle.
        <div role="radiogroup" aria-label="Voix" className="flex flex-wrap gap-1.5">
          {voices.map((voice) => {
            const active = voice.id === selectedVoiceId;
            const description = describeVoice(voice, showLanguage);
            return (
              <Tooltip key={voice.id} label={description}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-description={description}
                  onClick={() => onSelect(voice.id)}
                  className={cn(
                    "inline-flex h-8 max-w-full min-w-0 items-center gap-1 rounded-lg border pr-2.5 pl-1.5 text-sm transition",
                    active
                      ? neutral
                        ? "border-line-strong bg-line/50 font-medium text-ink"
                        : "border-[var(--provider)] bg-[color-mix(in_srgb,var(--provider)_10%,transparent)] font-medium text-ink"
                      : "border-line text-muted hover:border-line-strong hover:text-ink"
                  )}
                >
                  {GENDER_ICONS[voice.gender] && <Icon name={GENDER_ICONS[voice.gender]!} size={17} className={active && !neutral ? "text-[var(--provider)]" : undefined} />}
                  <span className="truncate">{voice.name}</span>
                  {/multiling/i.test(voice.quality) && <Icon name="multilingual" size={15} className="text-muted" />}
                </button>
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
}
