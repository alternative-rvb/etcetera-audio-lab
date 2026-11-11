import "server-only";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import type { SttAnalysis, SttHistoryEntry, SttProviderId, SttTranscriptionResult } from "@/lib/shared/types";
import { ensureDirectory, readJsonFile, writeJsonFileAtomic } from "@/lib/server/core/json-file-store";
import { createLogger } from "@/lib/server/core/logger";
import { PROJECT_PATHS } from "@/lib/server/core/paths";

// SECTION: Historique des transcriptions STT (output/stt_history.json + audios dans output/stt/).

const MAX_STT_HISTORY_ENTRIES = 100;
const systemLogger = createLogger("system");

type LegacySttHistoryEntry = Partial<SttHistoryEntry> & { engine?: string; durationSec?: number };

const LEGACY_ENGINE_TO_PROVIDER: Record<string, SttProviderId> = {
  whisper: "whisper",
  webspeech: "web-speech",
  sherpa: "sherpa",
};

function normalizeEntry(raw: LegacySttHistoryEntry): SttHistoryEntry {
  const fileName = raw.fileName;
  return {
    id: raw.id ?? `stt-${raw.createdAt}`,
    createdAt: raw.createdAt ?? new Date(0).toISOString(),
    provider: raw.provider ?? LEGACY_ENGINE_TO_PROVIDER[raw.engine ?? ""] ?? "whisper",
    text: raw.text ?? "",
    language: raw.language ?? "fr",
    languageProbability: raw.languageProbability,
    durationSec: raw.durationSec ?? 0,
    processingTimeMs: raw.processingTimeMs ?? 0,
    rtf: raw.rtf ?? 0,
    modelSize: raw.modelSize ?? "",
    device: raw.device ?? "",
    segments: raw.segments ?? [],
    runtime: raw.runtime,
    fallback: raw.fallback,
    fileName,
    filePath: fileName ? join(PROJECT_PATHS.sttAudioDir, fileName) : undefined,
    url: fileName ? `/audio/stt/${fileName}` : undefined,
    originalFilename: raw.originalFilename,
    isFavorite: raw.isFavorite ?? false,
    score: raw.score ?? 0,
    aiScore: raw.aiScore,
    analysis: raw.analysis,
  };
}

export function listSttHistory(): SttHistoryEntry[] {
  return readJsonFile<LegacySttHistoryEntry[]>(PROJECT_PATHS.sttHistoryFile, []).map(normalizeEntry);
}

function saveSttHistory(entries: SttHistoryEntry[]) {
  writeJsonFileAtomic(PROJECT_PATHS.sttHistoryFile, entries);
}

function removeAudioFile(entry: SttHistoryEntry) {
  try {
    if (entry.filePath && existsSync(entry.filePath)) unlinkSync(entry.filePath);
  } catch (err) {
    systemLogger.warn("history.file_delete_failed", `Fichier audio STT non supprimé : ${entry.fileName}`, { error: err });
  }
}

export function saveSttTranscription(
  audio: Buffer | null,
  meta: { provider: SttProviderId; originalFilename?: string; result: SttTranscriptionResult }
): SttHistoryEntry {
  const now = new Date();
  const suffix = Math.random().toString(36).slice(2, 6);
  let fileName: string | undefined;
  if (audio && audio.length > 0) {
    ensureDirectory(PROJECT_PATHS.sttAudioDir);
    const extension = (meta.originalFilename && extname(meta.originalFilename).replace(/[^.a-z0-9]/gi, "")) || ".wav";
    fileName = `${now.toISOString().replace(/[:.]/g, "-")}_stt_${meta.provider}_${suffix}${extension}`;
    writeFileSync(join(PROJECT_PATHS.sttAudioDir, fileName), audio);
  }

  const entry = normalizeEntry({
    ...meta.result,
    id: `stt-${Date.now()}-${suffix}`,
    createdAt: now.toISOString(),
    provider: meta.provider,
    originalFilename: meta.originalFilename,
    fileName,
    isFavorite: false,
    score: 0,
  });

  const all = [entry, ...listSttHistory()];
  for (const dropped of all.slice(MAX_STT_HISTORY_ENTRIES)) removeAudioFile(dropped);
  saveSttHistory(all.slice(0, MAX_STT_HISTORY_ENTRIES));
  return entry;
}

function updateSttEntry(id: string, update: (entry: SttHistoryEntry) => void): SttHistoryEntry | null {
  const all = listSttHistory();
  const entry = all.find((e) => e.id === id);
  if (!entry) return null;
  update(entry);
  saveSttHistory(all);
  return entry;
}

export function toggleSttFavorite(id: string) {
  return updateSttEntry(id, (entry) => {
    entry.isFavorite = !entry.isFavorite;
  });
}

export function setSttScore(id: string, score: number) {
  return updateSttEntry(id, (entry) => {
    entry.score = score;
  });
}

export function setSttAnalysis(id: string, analysis: SttAnalysis) {
  return updateSttEntry(id, (entry) => {
    entry.analysis = analysis;
    entry.aiScore = analysis.score;
  });
}

export function getSttEntry(id: string): SttHistoryEntry | null {
  return listSttHistory().find((entry) => entry.id === id) ?? null;
}

export function deleteSttHistoryEntry(id: string): boolean {
  const all = listSttHistory();
  const index = all.findIndex((e) => e.id === id);
  if (index === -1) return false;
  const [removed] = all.splice(index, 1);
  removeAudioFile(removed);
  saveSttHistory(all);
  return true;
}

export function clearSttHistory(): number {
  const all = listSttHistory();
  all.forEach(removeAudioFile);
  saveSttHistory([]);
  return all.length;
}
