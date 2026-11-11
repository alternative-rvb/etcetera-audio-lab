"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/client/cn";
import { Icon } from "./icon";
import { Tooltip } from "./tooltip";

// SECTION: Contrôles de réglage compacts (curseur, choix segmentés, interrupteur).
// NOTE: pas de liste déroulante : avec 2 à 4 options, tous les choix restent visibles en un coup d'oeil.

/** Aide d'un réglage, affichée en infobulle derrière une icône info pour ne pas allonger le formulaire. */
function SettingHelp({ text }: { text: string }) {
  return (
    <Tooltip label={text}>
      <button type="button" aria-label={`Aide : ${text}`} className="inline-flex text-muted hover:text-ink">
        <Icon name="info" size={14} />
      </button>
    </Tooltip>
  );
}

export function SettingSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => v.toFixed(2),
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="min-w-0 truncate text-sm text-ink">
          {label}
        </label>
        {hint && <SettingHelp text={hint} />}
        <output htmlFor={id} className="ml-auto text-sm font-medium tabular-nums text-[var(--provider,var(--accent))]">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="block w-full"
      />
    </div>
  );
}

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  /** Précision courte affichée à côté du libellé (taille du modèle...). */
  detail?: string;
  /** Raison de l'indisponibilité, affichée en infobulle. */
  disabledReason?: string;
}

export function SettingChoice<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  note,
}: {
  label: string;
  value: T;
  options: Array<ChoiceOption<T>>;
  onChange: (value: T) => void;
  hint?: string;
  /** Remarque visible sous les choix, réservée à ce qui change vraiment le résultat. */
  note?: ReactNode;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span id={labelId} className="flex w-24 shrink-0 items-center gap-1.5 text-sm text-ink">
        {label}
        {hint && <SettingHelp text={hint} />}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="flex min-w-0 flex-1 flex-wrap gap-1">
        {options.map((option) => {
          const active = option.value === value;
          const disabled = Boolean(option.disabledReason);
          const button = (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-disabled={disabled || undefined}
              onClick={() => !disabled && onChange(option.value)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm transition",
                active
                  ? "border-[var(--provider,var(--accent))] bg-[color-mix(in_srgb,var(--provider,var(--accent))_10%,transparent)] font-medium text-ink"
                  : "border-line text-muted hover:border-line-strong hover:text-ink",
                disabled && "cursor-not-allowed opacity-45 hover:border-line hover:text-muted"
              )}
            >
              {option.label}
              {option.detail && <span className="text-xs text-muted">{option.detail}</span>}
            </button>
          );
          return disabled ? (
            <Tooltip key={option.value} label={option.disabledReason}>
              {button}
            </Tooltip>
          ) : (
            button
          );
        })}
      </div>
      {note && <p className="w-full text-xs text-muted">{note}</p>}
    </div>
  );
}

export function SettingSwitch({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (checked: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-center gap-1.5 text-sm text-ink">
      <label htmlFor={id} className="cursor-pointer">
        {label}
      </label>
      {hint && <SettingHelp text={hint} />}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative ml-auto h-5 w-9 shrink-0 rounded-full transition sm:ml-2", checked ? "bg-[var(--provider,var(--accent))]" : "bg-line-strong")}
      >
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition", checked ? "left-[18px]" : "left-0.5")} />
      </button>
    </div>
  );
}
