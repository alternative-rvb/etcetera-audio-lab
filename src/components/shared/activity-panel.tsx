"use client";

import { Activity, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import type { LogSource } from "@/lib/shared/types";
import { CollapsiblePanel } from "@/components/ui/collapsible-panel";
import { useLogStream } from "@/hooks/use-log-stream";
import { LogEntryRow } from "./log-entry-row";

// SECTION: Panneau Activité des pages TTS et STT.
// ANCHOR: pendant une requête, trace en direct de ses logs (filtre requestId) ; sinon, derniers événements des providers de la page.

export function ActivityPanel({ storageKey, sources, requestId }: { storageKey: string; sources: LogSource[]; requestId?: string | null }) {
  const sourcesKey = sources.join(",");
  const filters = useMemo(
    () => (requestId ? { requestId } : { sources: sourcesKey.split(",") as LogSource[], minLevel: "info" as const }),
    [requestId, sourcesKey]
  );
  const { entries, status } = useLogStream(filters, { limit: 60 });
  const visible = entries.slice(-60).reverse();
  const logsHref = requestId ? `/logs?requestId=${requestId}` : "/logs";

  return (
    <CollapsiblePanel
      storageKey={storageKey}
      defaultOpen={false}
      icon={<Activity size={16} />}
      title="Activité"
      summary={
        <span className="flex items-center gap-1.5">
          <span className={status === "live" ? "size-1.5 rounded-full bg-success animate-pulse-dot" : "size-1.5 rounded-full bg-line-strong"} />
          {status !== "live" ? "hors ligne" : requestId ? "dernière requête" : "en direct"}
        </span>
      }
      actions={
        <Link href={logsHref} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
          Ouvrir dans les logs <ExternalLink size={12} />
        </Link>
      }
      bodyClassName="p-0 sm:p-0"
    >
      {visible.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">Aucun événement pour l'instant. Lancez une génération pour la suivre ici.</p>
      ) : (
        <ul aria-live="polite" className="max-h-72 overflow-y-auto">
          {visible.map((entry) => (
            <LogEntryRow key={entry.id} entry={entry} compact />
          ))}
        </ul>
      )}
    </CollapsiblePanel>
  );
}
