"use client";

import { ArrowDownToLine, Download, Pause, Play, ScrollText, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { LOG_LEVELS, type LogEntry, type LogLevel, type LogSource } from "@/lib/shared/types";
import { LOG_SOURCE_LABELS, providerColorVar } from "@/lib/shared/provider-catalog";
import { apiRequest, showErrorToast } from "@/lib/client/api-client";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/ui/feedback-controls";
import { Panel } from "@/components/ui/panel";
import { LogEntryRow } from "@/components/shared/log-entry-row";
import { useLogStream } from "@/hooks/use-log-stream";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { cn } from "@/lib/client/cn";

// SECTION: Explorateur de logs : un onglet par source (provider, API, service Python, navigateur), filtres, flux en direct.
// ANCHOR: le flux charge toutes les sources (2000 entrées max) et filtre côté navigateur, pour afficher les compteurs d'erreurs de chaque onglet.

type SourceTab = "all" | LogSource;

const SOURCE_GROUPS: Array<{ label: string; sources: LogSource[] }> = [
  { label: "Synthèse", sources: ["edge-tts", "piper", "kokoro", "chatterbox"] },
  { label: "Transcription", sources: ["web-speech", "whisper", "sherpa"] },
  { label: "Plateforme", sources: ["api", "python-service", "system", "browser"] },
];

const LEVEL_OPTIONS: Array<{ value: LogLevel; label: string }> = [
  { value: "debug", label: "Tout, debug compris" },
  { value: "info", label: "Info et plus" },
  { value: "warn", label: "Avertissements et erreurs" },
  { value: "error", label: "Erreurs seulement" },
];

function replaceUrlParams(params: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(null, "", url);
}

export function LogsExplorer({ initialSource, initialRequestId }: { initialSource: LogSource | null; initialRequestId: string | null }) {
  const [tab, setTab] = useState<SourceTab>(initialSource ?? "all");
  const [requestId, setRequestId] = useState<string | null>(initialRequestId);
  const [minLevel, setMinLevel] = usePersistentState<LogLevel>("logs-min-level", "info");
  const [search, setSearch] = useState("");
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  const serverFilters = useMemo(() => (requestId ? { requestId } : {}), [requestId]);
  const { entries, status, loading, reload, clearLocal } = useLogStream(serverFilters, { limit: 2000, paused });

  const minLevelIndex = LOG_LEVELS.indexOf(minLevel);
  const levelFiltered = useMemo(() => entries.filter((e) => LOG_LEVELS.indexOf(e.level) >= minLevelIndex), [entries, minLevelIndex]);

  const errorCounts = useMemo(() => {
    const counts = new Map<SourceTab, number>();
    for (const entry of entries) {
      if (entry.level !== "error") continue;
      counts.set(entry.source, (counts.get(entry.source) ?? 0) + 1);
      counts.set("all", (counts.get("all") ?? 0) + 1);
    }
    return counts;
  }, [entries]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return levelFiltered.filter((entry) => {
      if (tab !== "all" && entry.source !== tab) return false;
      if (!needle) return true;
      return `${entry.event} ${entry.message} ${entry.error?.message ?? ""} ${entry.requestId ?? ""}`.toLowerCase().includes(needle);
    });
  }, [levelFiltered, tab, search]);

  // NOTE: défilement automatique vers la dernière entrée, comme un `tail -f`.
  useEffect(() => {
    if (!autoScroll || paused) return;
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [visible.length, autoScroll, paused]);

  const selectTab = (next: SourceTab) => {
    setTab(next);
    replaceUrlParams({ sources: next === "all" ? null : next });
  };

  const selectRequestId = useCallback((next: string | null) => {
    setRequestId(next);
    replaceUrlParams({ requestId: next });
  }, []);

  const clearAll = async () => {
    try {
      await apiRequest("/api/logs", { method: "DELETE" });
      clearLocal();
      toast.success("Logs vidés");
      void reload();
    } catch (err) {
      showErrorToast(err, "Vidage des logs impossible");
    }
  };

  const exportVisible = () => {
    const blob = new Blob([JSON.stringify(visible, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `etcetera-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const tabButton = (id: SourceTab, label: string, color?: string) => {
    const active = tab === id;
    const errors = errorCounts.get(id) ?? 0;
    const total = id === "all" ? levelFiltered.length : levelFiltered.filter((e) => e.source === id).length;
    return (
      <button
        key={id}
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => selectTab(id)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition",
          active ? "bg-sunken font-medium text-ink retro:shadow-[inset_2px_0_0_var(--accent)]" : "text-muted hover:bg-sunken/60 hover:text-ink"
        )}
      >
        {color ? <span className="size-2 shrink-0 rounded-full" style={{ background: color }} /> : <ScrollText size={13} className="shrink-0" />}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {errors > 0 && (
          <span className="rounded-full bg-danger/15 px-1.5 text-[0.7rem] font-semibold tabular-nums text-danger" title={`${errors} erreur${errors > 1 ? "s" : ""}`}>
            {errors}
          </span>
        )}
        <span className="text-xs tabular-nums text-muted">{total}</span>
      </button>
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Sources de logs" className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div role="tablist" aria-orientation="vertical" className="space-y-0.5">
          {tabButton("all", "Toutes les sources")}
        </div>
        {SOURCE_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-2.5 text-xs font-medium text-muted">{group.label}</p>
            <div role="tablist" aria-orientation="vertical" className="space-y-0.5">
              {group.sources.map((source) => tabButton(source, LOG_SOURCE_LABELS[source], providerColorVar(source)))}
            </div>
          </div>
        ))}
      </nav>

      <Panel
        icon={<ScrollText size={16} />}
        title={tab === "all" ? "Toutes les sources" : LOG_SOURCE_LABELS[tab]}
        actions={
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className={status === "live" && !paused ? "size-1.5 rounded-full bg-success animate-pulse-dot" : "size-1.5 rounded-full bg-line-strong"} />
            {paused ? "en pause" : status === "live" ? "en direct" : status === "connecting" ? "connexion" : "hors ligne"}
            <span className="ml-2 tabular-nums">{visible.length} entrée{visible.length > 1 ? "s" : ""}</span>
          </span>
        }
        bodyClassName="p-0 sm:p-0"
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <label className="relative min-w-[200px] flex-1">
            <span className="sr-only">Rechercher dans les logs</span>
            <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un événement, un message, un identifiant"
              className="h-9 w-full rounded-lg border border-line bg-sunken pr-2.5 pl-8 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </label>
          <select
            aria-label="Niveau minimal"
            value={minLevel}
            onChange={(event) => setMinLevel(event.target.value as LogLevel)}
            className="h-9 rounded-lg border border-line bg-sunken px-2.5 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {LEVEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button icon={paused ? <Play size={14} /> : <Pause size={14} />} onClick={() => setPaused(!paused)}>
            {paused ? "Reprendre" : "Pause"}
          </Button>
          <Button
            variant={autoScroll ? "secondary" : "ghost"}
            icon={<ArrowDownToLine size={14} />}
            aria-pressed={autoScroll}
            onClick={() => setAutoScroll(!autoScroll)}
            title="Suivre automatiquement les nouvelles entrées"
          >
            Suivre
          </Button>
          <Button variant="ghost" icon={<Download size={14} />} onClick={exportVisible} disabled={visible.length === 0}>
            Exporter
          </Button>
          <ConfirmDeleteButton label="Vider" confirmLabel="Vider tous les logs" onConfirm={() => void clearAll()} />
        </div>

        {requestId && (
          <div className="flex items-center gap-2 border-b border-line bg-accent/5 px-4 py-2 text-sm">
            <span className="text-muted">Requête</span>
            <code className="font-mono text-ink">{requestId}</code>
            <button type="button" onClick={() => selectRequestId(null)} className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
              <X size={12} /> Retirer le filtre
            </button>
          </div>
        )}

        <div ref={listRef} className="h-[calc(100dvh-260px)] min-h-[360px] overflow-y-auto">
          {loading && entries.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">Chargement des logs...</p>
          ) : visible.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted">
              <p>Aucune entrée pour ces filtres.</p>
              {minLevel !== "debug" && (
                <button type="button" className="mt-2 text-xs text-accent hover:underline" onClick={() => setMinLevel("debug")}>
                  Afficher aussi le niveau debug
                </button>
              )}
            </div>
          ) : (
            <ul aria-live={paused ? "off" : "polite"} aria-relevant="additions">
              {visible.map((entry: LogEntry) => (
                <LogEntryRow key={entry.id} entry={entry} onSelectRequestId={selectRequestId} />
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
}
