"use client";

import { ChevronDown } from "lucide-react";
import { useId, type ReactNode } from "react";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { cn } from "@/lib/client/cn";

// SECTION: Panneau repliable dont l'état ouvert/fermé est mémorisé par l'utilisateur.

export function CollapsiblePanel({
  storageKey,
  title,
  icon,
  summary,
  actions,
  defaultOpen = true,
  children,
  className,
  bodyClassName,
}: {
  storageKey: string;
  title: ReactNode;
  icon?: ReactNode;
  /** Résumé affiché à côté du titre (compteur, badge), visible même replié. */
  summary?: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const [open, setOpen] = usePersistentState(`panel-${storageKey}`, defaultOpen);
  const bodyId = useId();

  return (
    <section className={cn("panel rounded-2xl border border-line bg-surface", className)}>
      <header className={cn("flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5", open && "border-b border-line")}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(!open)}
          className="group -mx-1 flex items-center gap-2 rounded-md px-1 text-left"
        >
          <ChevronDown size={16} className={cn("text-muted transition-transform", !open && "-rotate-90")} />
          <h2 className="panel-title flex items-center gap-2 text-[0.95rem] font-semibold text-ink">
            {icon && <span className="text-muted">{icon}</span>}
            {title}
          </h2>
          {summary && <span className="text-xs text-muted">{summary}</span>}
        </button>
        {actions && open && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
      </header>
      <div id={bodyId} hidden={!open} className={cn("p-4 sm:p-5", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
