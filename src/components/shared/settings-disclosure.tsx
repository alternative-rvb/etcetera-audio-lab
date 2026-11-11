"use client";

import { useId, type ReactNode } from "react";
import { IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { cn } from "@/lib/client/cn";

// SECTION: Réglages repliables d'un provider, avec un résumé de ce qui s'écarte des valeurs par défaut.

/** Nombre de réglages qui diffèrent des valeurs par défaut (comparaison champ par champ). */
export function countModifiedSettings(current: object, defaults: object): number {
  const currentRecord = current as Record<string, unknown>;
  return Object.entries(defaults).filter(([key, value]) => currentRecord[key] !== value).length;
}

export function SettingsDisclosure({
  storageKey,
  providerLabel,
  modifiedCount,
  onReset,
  children,
}: {
  storageKey: string;
  providerLabel: string;
  modifiedCount: number;
  onReset: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = usePersistentState(`settings-${storageKey}`, false);
  const bodyId = useId();
  const summary = modifiedCount === 0 ? "par défaut" : `${modifiedCount} modifié${modifiedCount > 1 ? "s" : ""}`;

  return (
    <div className="rounded-xl border border-line">
      <div className="flex items-center gap-1 pr-1">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(!open)}
          className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 text-left text-sm"
        >
          <Icon name="tune" size={18} className="text-muted" />
          <span className="truncate font-medium text-ink">Réglages {providerLabel}</span>
          <span className={cn("shrink-0 text-xs", modifiedCount ? "font-medium text-[var(--provider,var(--accent))]" : "text-muted")}>{summary}</span>
          <Icon name="expand" size={20} className={cn("ml-auto text-muted transition-transform", open && "rotate-180")} />
        </button>
        {modifiedCount > 0 && (
          <IconButton label="Revenir aux valeurs par défaut" onClick={onReset}>
            <Icon name="reset" />
          </IconButton>
        )}
      </div>
      <div id={bodyId} hidden={!open} className="border-t border-line px-3 pt-2.5 pb-3">
        {children}
      </div>
    </div>
  );
}
