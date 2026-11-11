"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiRequest, jsonBody, showErrorToast } from "@/lib/client/api-client";

// SECTION: Historique commun TTS et STT (liste, favori, note, suppression, vidage).
// ANCHOR: les deux historiques exposent les mêmes routes sous /api/tts/history et /api/stt/history.

interface HistoryItemBase {
  id: string;
  isFavorite: boolean;
  score: number;
}

export function useHistoryCollection<T extends HistoryItemBase>(basePath: "/api/tts/history" | "/api/stt/history") {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await apiRequest<T[]>(basePath));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const replaceItem = useCallback((updated: T) => {
    setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }, []);

  const prepend = useCallback((entry: T) => {
    setItems((current) => [entry, ...current.filter((item) => item.id !== entry.id)]);
  }, []);

  const toggleFavorite = useCallback(
    async (id: string) => {
      try {
        const updated = await apiRequest<T>(`${basePath}/${encodeURIComponent(id)}/favorite`, { method: "POST" });
        replaceItem(updated);
        return updated;
      } catch (err) {
        showErrorToast(err, "Favori non enregistré");
        return null;
      }
    },
    [basePath, replaceItem]
  );

  const setScore = useCallback(
    async (id: string, score: number) => {
      try {
        const updated = await apiRequest<T>(`${basePath}/${encodeURIComponent(id)}/score`, { method: "PUT", ...jsonBody({ score }) });
        replaceItem(updated);
        return updated;
      } catch (err) {
        showErrorToast(err, "Note non enregistrée");
        return null;
      }
    },
    [basePath, replaceItem]
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await apiRequest(`${basePath}/${encodeURIComponent(id)}`, { method: "DELETE" });
        setItems((current) => current.filter((item) => item.id !== id));
        toast.success("Entrée supprimée");
        return true;
      } catch (err) {
        showErrorToast(err, "Suppression impossible");
        return false;
      }
    },
    [basePath]
  );

  const clear = useCallback(async () => {
    try {
      const { removed } = await apiRequest<{ removed: number }>(basePath, { method: "DELETE" });
      setItems([]);
      toast.success(`Historique vidé (${removed} entrée${removed > 1 ? "s" : ""})`);
    } catch (err) {
      showErrorToast(err, "Vidage impossible");
    }
  }, [basePath]);

  return { items, loading, loadError, reload, prepend, replaceItem, toggleFavorite, setScore, remove, clear };
}
