import { icon } from "./shared/icons.js";
import { initTtsModule } from "./tts/index.js";
import { initSttModule } from "./stt/index.js";

type ThemeMode = "light" | "dark" | "retro";

const themeToggleEl = document.getElementById("themeToggle") as HTMLButtonElement | null;
const headerBrandIcon = document.getElementById("headerBrandIcon") as HTMLSpanElement | null;

// Thème : Clair / Sombre / Rétro Y2K Cyber, bascule mémorisée en localStorage.
function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  let iconName = "moon";
  let title = "Passer en mode sombre";

  if (theme === "light") {
    iconName = "moon";
    title = "Passer en mode sombre";
  } else if (theme === "dark") {
    iconName = "terminal";
    title = "Passer en mode Rétro Y2K Cyber";
  } else if (theme === "retro") {
    iconName = "sun";
    title = "Passer en mode clair";
  }

  if (themeToggleEl) {
    themeToggleEl.innerHTML = icon(iconName, { size: 18 });
    themeToggleEl.title = title;
  }
}

function initTheme() {
  try {
    const stored = localStorage.getItem("tts-test-theme") as ThemeMode | null;
    if (stored === "light" || stored === "dark" || stored === "retro") {
      applyTheme(stored);
      return;
    }
  } catch {
    // localStorage indisponible : on retombe sur la préférence système.
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

if (themeToggleEl) {
  themeToggleEl.addEventListener("click", () => {
    const current = (document.documentElement.dataset.theme as ThemeMode) || "light";
    let next: ThemeMode = "dark";
    if (current === "light") next = "dark";
    else if (current === "dark") next = "retro";
    else next = "light";

    applyTheme(next);
    try {
      localStorage.setItem("tts-test-theme", next);
    } catch {
      // ignoré
    }
  });
}

if (headerBrandIcon) {
  headerBrandIcon.innerHTML = icon("audiolines", { size: 19, color: "#ffffff" });
}

// Initialisation globale
initTheme();
initTtsModule();
initSttModule();
