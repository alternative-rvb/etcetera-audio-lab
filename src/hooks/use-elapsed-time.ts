"use client";

import { useEffect, useState } from "react";

// ANCHOR: chronomètre affiché pendant une génération ou une transcription.
export function useElapsedTime(running: boolean, intervalMs = 100): number {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!running) {
      setStartedAt(null);
      return;
    }
    const start = Date.now();
    setStartedAt(start);
    setNow(start);
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [running, intervalMs]);

  return startedAt ? now - startedAt : 0;
}
