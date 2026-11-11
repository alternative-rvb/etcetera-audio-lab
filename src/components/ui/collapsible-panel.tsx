"use client";

import { useEffect, useId, type ReactNode } from "react";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { cn } from "@/lib/client/cn";
import { Icon } from "./icon";

// SECTION: Panneau repliable dont l'état ouvert/fermé est mémorisé par l'utilisateur.

export function CollapsiblePanel({
  storageKey,
  title,
  summary,
  actions,
  defaultOpen = true,
  disabled = false,
  forceOpen = false,
  children,
  className,
  bodyClassName,
}: {
  storageKey: string;
  title: ReactNode;
  /** Résumé affiché à côté du titre (compteur, état), visible même replié. */
  summary?: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
  /** Panneau sans contenu utile pour l'instant : replié et non dépliable, le résumé dit pourquoi. */
  disabled?: boolean;
  /** Ouvre le panneau quand la valeur passe à vrai (requête en cours...), l'utilisateur peut le refermer ensuite. */
  forceOpen?: boolean;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const [storedOpen, setOpen] = usePersistentState(`panel-${storageKey}`, defaultOpen);
  const bodyId = useId();
  const open = storedOpen && !disabled;

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen, setOpen]);

  return (
    <section className={cn("panel rounded-2xl border border-line bg-surface", className)}>
      <header className={cn("flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-2.5 sm:px-4", open && "border-b border-line")}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className="group -mx-1 flex min-w-0 items-center gap-1.5 rounded-md px-1 text-left disabled:cursor-default"
        >
          <Icon name="expand" size={20} className={cn("text-muted transition-transform", !open && "-rotate-90", disabled && "opacity-40")} />
          <h2 className={cn("panel-title text-[0.95rem] font-semibold", disabled ? "text-muted" : "text-ink")}>{title}</h2>
          {summary && <span className="min-w-0 truncate text-xs text-muted">{summary}</span>}
        </button>
        {actions && open && <div className="flex flex-wrap items-center gap-1">{actions}</div>}
      </header>
      <div id={bodyId} hidden={!open} className={cn("p-3 sm:p-4", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
