import type { SttHistoryEntry, TtsHistoryEntry } from "./types";

// SECTION: Matériel sur lequel une mesure a été prise. Le banc d'essai vise un VPS sans GPU : seul le GPU fausse la comparaison.

export type Hardware = "cpu" | "gpu" | "cloud" | "browser";

export const HARDWARE_LABELS: Record<Hardware, string> = {
  cpu: "CPU",
  gpu: "GPU",
  cloud: "Cloud",
  browser: "Navigateur",
};

export const HARDWARE_HINTS: Record<Hardware, string> = {
  cpu: "Mesuré sur processeur : représentatif d'un VPS sans GPU.",
  gpu: "Mesuré sur carte graphique : non représentatif d'un VPS sans GPU.",
  cloud: "Mesuré chez un service distant : dépend du réseau, pas de la machine.",
  browser: "Traité dans le navigateur : pas de mesure de temps côté serveur.",
};

export function ttsHardware(entry: Pick<TtsHistoryEntry, "provider" | "settings">): Hardware {
  if (entry.provider === "edge-tts") return "cloud";
  if (entry.provider === "chatterbox" && entry.settings?.device === "cuda") return "gpu";
  return "cpu";
}

export function sttHardware(entry: Pick<SttHistoryEntry, "provider" | "device">): Hardware {
  if (entry.provider === "web-speech") return "browser";
  const device = entry.device.toLowerCase();
  if (device.startsWith("cloud")) return "cloud";
  if (device === "cuda" || device === "gpu") return "gpu";
  return "cpu";
}

/** Vrai pour toute mesure comparable à un VPS sans GPU. */
export function isVpsComparable(hardware: Hardware): boolean {
  return hardware !== "gpu";
}
