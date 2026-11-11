"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { HealthReport } from "@/lib/shared/types";
import { apiRequest } from "@/lib/client/api-client";

// SECTION: État de santé des providers partagé par toute l'app (rafraîchi toutes les 15 s).

const HEALTH_REFRESH_MS = 15_000;

interface HealthContextValue {
  report: HealthReport | null;
  refresh: () => Promise<void>;
}

const HealthContext = createContext<HealthContextValue>({ report: null, refresh: async () => undefined });

export function HealthProvider({ children }: { children: ReactNode }) {
  const [report, setReport] = useState<HealthReport | null>(null);

  const refresh = useCallback(async () => {
    try {
      setReport(await apiRequest<HealthReport>("/api/health"));
    } catch {
      // NOTE: santé inconnue, les pastilles restent grises.
      setReport(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), HEALTH_REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return <HealthContext.Provider value={{ report, refresh }}>{children}</HealthContext.Provider>;
}

export function useHealth() {
  return useContext(HealthContext);
}
