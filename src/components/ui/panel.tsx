import type { ReactNode } from "react";
import { cn } from "@/lib/client/cn";

// SECTION: Panneau de section (titre, précision à côté, actions à droite, contenu).

export function Panel({
  title,
  meta,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  /** Précision courte à côté du titre (origine de l'audio, compteur). */
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("panel flex min-h-44 flex-col rounded-2xl border border-line bg-surface", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-line px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="panel-title text-[0.95rem] font-semibold text-ink">{title}</h2>
            {meta && <span className="min-w-0 truncate text-xs text-muted">{meta}</span>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-1">{actions}</div>}
        </header>
      )}
      <div className={cn("flex-1 p-3 sm:p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line px-4 py-6 text-center">
      {icon && <span className="text-muted">{icon}</span>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="max-w-sm text-xs text-muted">{children}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-sunken", className)} />;
}
