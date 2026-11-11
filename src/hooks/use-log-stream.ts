"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LogEntry, LogLevel, LogSource } from "@/lib/shared/types";
import { apiRequest } from "@/lib/client/api-client";

// SECTION: Logs en temps réel : chargement initial (GET /api/logs) puis flux SSE (/api/logs/stream).

export interface LogStreamFilters {
  sources?: LogSource[];
  minLevel?: LogLevel;
  requestId?: string;
  search?: string;
}

const MAX_CLIENT_ENTRIES = 2000;

function toQueryString(filters: LogStreamFilters, limit: number): string {
  const params = new URLSearchParams();
  if (filters.sources?.length) params.set("sources", filters.sources.join(","));
  if (filters.minLevel) params.set("minLevel", filters.minLevel);
  if (filters.requestId) params.set("requestId", filters.requestId);
  if (filters.search) params.set("search", filters.search);
  params.set("limit", String(limit));
  return params.toString();
}

export function useLogStream(filters: LogStreamFilters, options: { enabled?: boolean; limit?: number; paused?: boolean } = {}) {
  const { enabled = true, limit = 500, paused = false } = options;
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [loading, setLoading] = useState(true);
  const pausedRef = useRef(paused);
  const pendingRef = useRef<LogEntry[]>([]);
  const query = useMemo(() => toQueryString(filters, limit), [filters, limit]);

  pausedRef.current = paused;

  // NOTE: à la reprise, on injecte les entrées reçues pendant la pause.
  useEffect(() => {
    if (!paused && pendingRef.current.length) {
      const pending = pendingRef.current;
      pendingRef.current = [];
      setEntries((current) => mergeEntries(current, pending));
    }
  }, [paused]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await apiRequest<LogEntry[]>(`/api/logs?${query}`));
    } catch {
      setStatus("offline");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setEntries([]);
    void reload();

    const source = new EventSource(`/api/logs/stream?${query}`);
    setStatus("connecting");
    source.onopen = () => !cancelled && setStatus("live");
    source.onerror = () => !cancelled && setStatus("offline");
    source.onmessage = (event) => {
      if (cancelled) return;
      const entry = JSON.parse(event.data) as LogEntry;
      if (pausedRef.current) {
        pendingRef.current.push(entry);
        return;
      }
      setEntries((current) => mergeEntries(current, [entry]));
    };
    return () => {
      cancelled = true;
      source.close();
    };
  }, [enabled, query, reload]);

  return { entries, status, loading, reload, clearLocal: () => setEntries([]) };
}

function mergeEntries(current: LogEntry[], incoming: LogEntry[]): LogEntry[] {
  const known = new Set(current.map((e) => e.id));
  const merged = [...current, ...incoming.filter((e) => !known.has(e.id))].sort((a, b) => a.seq - b.seq);
  return merged.length > MAX_CLIENT_ENTRIES ? merged.slice(-MAX_CLIENT_ENTRIES) : merged;
}
