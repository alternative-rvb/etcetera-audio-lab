"use client";

import { useEffect, useState } from "react";

// ANCHOR: état mémorisé dans localStorage (préférences de l'utilisateur), préfixe "etcetera-".
export function usePersistentState<T>(key: string, initialValue: T): [T, (value: T | ((previous: T) => T)) => void] {
  const storageKey = `etcetera-${key}`;
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) setValue(JSON.parse(stored) as T);
    } catch {
      // NOTE: localStorage indisponible (navigation privée), on garde la valeur initiale.
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // NOTE: quota ou accès refusé, sans impact fonctionnel.
    }
  }, [storageKey, value, hydrated]);

  return [value, setValue];
}
