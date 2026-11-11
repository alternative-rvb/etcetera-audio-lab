import "server-only";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AudioFormat, TtsHistoryEntry, TtsProviderId } from "@/lib/shared/types";
import { ensureDirectory, readJsonFile, writeJsonFileAtomic } from "@/lib/server/core/json-file-store";
import { createLogger } from "@/lib/server/core/logger";
import { PROJECT_PATHS } from "@/lib/server/core/paths";

// SECTION: Historique des audios TTS générés (output/history.json + fichiers audio dans output/).

const MAX_TTS_HISTORY_ENTRIES = 50;
const systemLogger = createLogger("system");

/** Ancien format (avant migration) : champ `engine` au lieu de `provider`, upvotes, chemins absolus server/output. */
type LegacyTtsHistoryEntry = Partial<TtsHistoryEntry> & { engine?: string; upvotes?: number };

const LEGACY_ENGINE_TO_PROVIDER: Record<string, TtsProviderId> = {
  edge: "edge-tts",
  piper: "piper",
  kokoro: "kokoro",
  chatterbox: "chatterbox",
};

function normalizeEntry(raw: LegacyTtsHistoryEntry): TtsHistoryEntry {
  const fileName = raw.fileName ?? "";
  return {
    id: raw.id ?? fileName,
    createdAt: raw.createdAt ?? new Date(0).toISOString(),
    text: raw.text ?? "",
    provider: raw.provider ?? LEGACY_ENGINE_TO_PROVIDER[raw.engine ?? ""] ?? "piper",
    voiceId: raw.voiceId ?? "",
    voiceName: raw.voiceName ?? raw.voiceId ?? "",
    fileName,
    // NOTE: le chemin est recalculé à chaque lecture, les anciens chemins absolus (server/output) ne sont plus valides.
    filePath: join(PROJECT_PATHS.ttsAudioDir, fileName),
    url: `/audio/${fileName}`,
    format: raw.format ?? "wav",
    sizeBytes: raw.sizeBytes ?? 0,
    isFavorite: raw.isFavorite ?? false,
    score: raw.score ?? 0,
    generationTimeMs: raw.generationTimeMs ?? 0,
    settings: raw.settings,
  };
}

export function listTtsHistory(): TtsHistoryEntry[] {
  return readJsonFile<LegacyTtsHistoryEntry[]>(PROJECT_PATHS.ttsHistoryFile, []).map(normalizeEntry);
}

function saveTtsHistory(entries: TtsHistoryEntry[]) {
  writeJsonFileAtomic(PROJECT_PATHS.ttsHistoryFile, entries);
}

function removeAudioFile(entry: TtsHistoryEntry) {
  try {
    if (entry.fileName && existsSync(entry.filePath)) unlinkSync(entry.filePath);
  } catch (err) {
    systemLogger.warn("history.file_delete_failed", `Fichier audio non supprimé : ${entry.fileName}`, { error: err });
  }
}

export function saveTtsAudio(
  audio: Buffer,
  meta: {
    text: string;
    provider: TtsProviderId;
    voiceId: string;
    voiceName: string;
    format: AudioFormat;
    generationTimeMs: number;
    settings?: Record<string, unknown>;
  }
): TtsHistoryEntry {
  ensureDirectory(PROJECT_PATHS.ttsAudioDir);
  const now = new Date();
  const suffix = Math.random().toString(36).slice(2, 6);
  const safeVoiceId = meta.voiceId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${now.toISOString().replace(/[:.]/g, "-")}_${meta.provider}_${safeVoiceId}_${suffix}.${meta.format}`;
  writeFileSync(join(PROJECT_PATHS.ttsAudioDir, fileName), audio);

  const entry = normalizeEntry({
    id: `${Date.now()}-${suffix}`,
    createdAt: now.toISOString(),
    ...meta,
    fileName,
    sizeBytes: audio.length,
    isFavorite: false,
    score: 0,
  });

  const all = [entry, ...listTtsHistory()];
  for (const dropped of all.slice(MAX_TTS_HISTORY_ENTRIES)) removeAudioFile(dropped);
  saveTtsHistory(all.slice(0, MAX_TTS_HISTORY_ENTRIES));
  return entry;
}

function updateTtsEntry(id: string, update: (entry: TtsHistoryEntry) => void): TtsHistoryEntry | null {
  const all = listTtsHistory();
  const entry = all.find((e) => e.id === id);
  if (!entry) return null;
  update(entry);
  saveTtsHistory(all);
  return entry;
}

export function toggleTtsFavorite(id: string) {
  return updateTtsEntry(id, (entry) => {
    entry.isFavorite = !entry.isFavorite;
  });
}

export function setTtsScore(id: string, score: number) {
  return updateTtsEntry(id, (entry) => {
    entry.score = score;
  });
}

export function deleteTtsHistoryEntry(id: string): boolean {
  const all = listTtsHistory();
  const index = all.findIndex((e) => e.id === id);
  if (index === -1) return false;
  const [removed] = all.splice(index, 1);
  removeAudioFile(removed);
  saveTtsHistory(all);
  return true;
}

export function clearTtsHistory(): number {
  const all = listTtsHistory();
  all.forEach(removeAudioFile);
  saveTtsHistory([]);
  return all.length;
}
