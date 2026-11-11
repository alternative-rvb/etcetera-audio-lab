"use client";

import { useCallback, useEffect, useState } from "react";
import type { TtsProviderId, TtsVoiceList } from "@/lib/shared/types";
import { apiRequest } from "@/lib/client/api-client";

// ANCHOR: chargement des voix d'un provider TTS (rechargé à chaque changement de provider).
export function useTtsVoices(provider: TtsProviderId, locale = "fr-FR") {
  const [voiceList, setVoiceList] = useState<TtsVoiceList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    apiRequest<TtsVoiceList>(`/api/voices?provider=${provider}&locale=${locale}`, { signal: controller.signal })
      .then((list) => setVoiceList(list))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setVoiceList(null);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [provider, locale, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { voiceList, loading, error, retry };
}
