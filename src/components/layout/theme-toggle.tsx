"use client";

import { Moon, Sun, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui/button";

// SECTION: Bascule de thème clair → sombre → rétro Y2K, mémorisée dans localStorage.

export type ThemeMode = "light" | "dark" | "retro";
export const THEME_STORAGE_KEY = "etcetera-theme";
const LEGACY_THEME_STORAGE_KEY = "tts-test-theme";

const NEXT_THEME: Record<ThemeMode, ThemeMode> = { light: "dark", dark: "retro", retro: "light" };
const NEXT_THEME_LABEL: Record<ThemeMode, string> = {
  light: "Passer en thème sombre",
  dark: "Passer en thème rétro Y2K",
  retro: "Passer en thème clair",
};

/** Script injecté dans <head> pour appliquer le thème avant le premier rendu (évite le flash). */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}")||localStorage.getItem("${LEGACY_THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"&&t!=="retro"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})();`;

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as ThemeMode) || "light");
  }, []);

  const cycleTheme = () => {
    const next = NEXT_THEME[theme];
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // NOTE: préférence non mémorisée, sans impact.
    }
  };

  const Icon = theme === "light" ? Moon : theme === "dark" ? Terminal : Sun;
  return (
    <IconButton label={NEXT_THEME_LABEL[theme]} onClick={cycleTheme} className="size-9 border border-line">
      <Icon size={17} />
    </IconButton>
  );
}
