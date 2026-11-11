"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import type { LogEntry, LogLevel } from "@/lib/shared/types";
import { ProviderBadge } from "@/components/ui/provider-badge";
import { CopyButton } from "@/components/ui/feedback-controls";
import { cn } from "@/lib/client/cn";

// SECTION: Ligne de log dépliable, partagée par la page Logs et le panneau Activité.

const LEVEL_CLASSES: Record<LogLevel, string> = {
  debug: "text-muted",
  info: "text-accent",
  warn: "text-warning",
  error: "text-danger",
};

const LEVEL_LABELS: Record<LogLevel, string> = { debug: "debug", info: "info", warn: "warn", error: "error" };

function formatLogTime(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleTimeString("fr-FR", { hour12: false })}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}

export function LogEntryRow({
  entry,
  compact = false,
  onSelectRequestId,
}: {
  entry: LogEntry;
  compact?: boolean;
  onSelectRequestId?: (requestId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = Boolean(entry.meta || entry.error || entry.requestId);

  return (
    <li className={cn("border-b border-line/60 font-mono text-xs last:border-b-0", entry.level === "error" && "bg-danger/5")}>
      <button
        type="button"
        onClick={() => hasDetails && setExpanded(!expanded)}
        aria-expanded={hasDetails ? expanded : undefined}
        className={cn("flex w-full items-start gap-2 px-3 py-1.5 text-left", hasDetails && "hover:bg-sunken")}
      >
        <ChevronRight size={12} className={cn("mt-0.5 shrink-0 text-muted transition-transform", expanded && "rotate-90", !hasDetails && "invisible")} />
        <time className="shrink-0 tabular-nums text-muted">{formatLogTime(entry.ts)}</time>
        <span className={cn("w-10 shrink-0 font-semibold", LEVEL_CLASSES[entry.level])}>{LEVEL_LABELS[entry.level]}</span>
        <ProviderBadge provider={entry.source} className="shrink-0" />
        {/* NOTE: en mode compact (panneau Activité), l'événement reste visible au survol et une fois la ligne dépliée. */}
        {!compact && <span className="shrink-0 text-muted">{entry.event}</span>}
        <span title={compact ? `${entry.event} : ${entry.message}` : undefined} className={cn("min-w-0 flex-1 text-ink", compact ? "truncate" : "break-words")}>
          {entry.message}
        </span>
        {entry.durationMs !== undefined && <span className="shrink-0 tabular-nums text-muted">{entry.durationMs} ms</span>}
      </button>

      {expanded && (
        <div className="space-y-2 px-3 pb-3 pl-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
            {compact && <span>événement : {entry.event}</span>}
            <span>origine : {entry.origin}</span>
            {entry.requestId && (
              <span className="flex items-center gap-1">
                requête :
                {onSelectRequestId ? (
                  <button type="button" className="text-accent underline-offset-2 hover:underline" onClick={() => onSelectRequestId(entry.requestId!)}>
                    {entry.requestId}
                  </button>
                ) : (
                  <span className="text-ink">{entry.requestId}</span>
                )}
                <CopyButton text={entry.requestId} label="Copier l'identifiant de requête" />
              </span>
            )}
          </div>
          {entry.error && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 p-2">
              <p className="font-semibold break-words text-danger">
                {entry.error.name}
                {entry.error.code ? ` (${entry.error.code})` : ""} : {entry.error.message}
              </p>
              {entry.error.stack && <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap text-[0.7rem] text-muted">{entry.error.stack}</pre>}
              {entry.error.cause && <p className="mt-1 text-muted">Cause : {entry.error.cause.message}</p>}
            </div>
          )}
          {entry.meta && (
            <pre className="max-h-64 overflow-auto rounded-lg bg-sunken p-2 text-[0.7rem] whitespace-pre-wrap text-ink">{JSON.stringify(entry.meta, null, 2)}</pre>
          )}
        </div>
      )}
    </li>
  );
}
