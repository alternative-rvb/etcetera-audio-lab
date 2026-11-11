import type { TtsVoice } from "@/lib/shared/types";

// SECTION: Utilitaires mutualisés pour les catalogues de voix.

export function normalizeLocale(locale: string): string {
  return locale.toLowerCase().replace("_", "-");
}

/** Filtre par locale exacte (fr-FR) ou par langue (fr). `undefined` ou "all" renvoie tout. */
export function filterVoicesByLocale<T extends Pick<TtsVoice, "language">>(voices: T[], locale?: string): T[] {
  if (!locale || locale === "all") return voices;
  const wanted = normalizeLocale(locale);
  return voices.filter((voice) => {
    const language = normalizeLocale(voice.language);
    return wanted.includes("-") ? language === wanted : language.startsWith(wanted);
  });
}
