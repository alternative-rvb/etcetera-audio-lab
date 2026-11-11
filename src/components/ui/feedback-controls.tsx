"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/client/cn";
import { Button, IconButton } from "./button";
import { Icon } from "./icon";

// SECTION: Notation, favori, copie et suppression avec confirmation intégrée (pas de confirm()).

export function StarRating({ value, onChange, size = 15, label = "Note" }: { value: number; onChange?: (score: number) => void; size?: number; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-0.5">
      {[1, 2, 3].map((score) => {
        const active = value >= score;
        return (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={value === score}
            aria-label={`${score} étoile${score > 1 ? "s" : ""}`}
            disabled={!onChange}
            onClick={(event) => {
              event.stopPropagation();
              onChange?.(value === score ? 0 : score);
            }}
            className={cn("rounded p-px transition enabled:hover:scale-110", active ? "text-amber-400" : "text-line-strong enabled:hover:text-amber-300")}
          >
            <Icon name={active ? "star" : "starOutline"} size={size + 2} />
          </button>
        );
      })}
    </div>
  );
}

export function FavoriteToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <IconButton
      label={active ? "Retirer des favoris" : "Ajouter aux favoris"}
      aria-pressed={active}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cn(active && "text-rose-500 hover:text-rose-500")}
    >
      <Icon name={active ? "favorite" : "favoriteOutline"} size={18} />
    </IconButton>
  );
}

export function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <IconButton
      label={copied ? "Copié" : label}
      onClick={async (event) => {
        event.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          // NOTE: presse-papiers refusé par le navigateur, l'icône ne change pas.
        }
      }}
    >
      {copied ? <Icon name="check" size={17} className="text-success" /> : <Icon name="copy" size={17} />}
    </IconButton>
  );
}

/** Bouton destructif en deux temps : premier clic = demande, second clic = confirmation. */
export function ConfirmDeleteButton({ onConfirm, label, confirmLabel = "Confirmer", compact = false }: { onConfirm: () => void; label: string; confirmLabel?: string; compact?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  if (armed) {
    return (
      <Button
        size="sm"
        variant="danger"
        className="border-danger/50 bg-danger/10"
        onClick={(event) => {
          event.stopPropagation();
          setArmed(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </Button>
    );
  }
  if (compact) {
    return (
      <IconButton label={label} className="hover:text-danger" onClick={(event) => { event.stopPropagation(); setArmed(true); }}>
        <Icon name="delete" size={18} />
      </IconButton>
    );
  }
  return (
    <Button size="sm" variant="ghost" icon={<Icon name="delete" size={16} />} onClick={(event) => { event.stopPropagation(); setArmed(true); }}>
      {label}
    </Button>
  );
}
