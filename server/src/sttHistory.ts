import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { STTSegment } from "./stt.js";

export interface STTHistoryEntry {
  id: string;
  createdAt: string;
  text: string;
  engine: "whisper" | "webspeech" | "sherpa";
  modelSize?: string;
  device?: string;
  language: string;
  durationSec: number;
  processingTimeMs: number;
  rtf: number;
  filePath?: string;
  fileName?: string;
  url?: string;
  segments: STTSegment[];
  score?: number; // 0, 1, 2, 3
  isFavorite?: boolean;
}

const OUTPUT_DIR = join(import.meta.dirname, "..", "output");
const STT_OUTPUT_DIR = join(OUTPUT_DIR, "stt");
const STT_HISTORY_FILE = join(OUTPUT_DIR, "stt_history.json");

function ensureSttDir() {
  if (!existsSync(STT_OUTPUT_DIR)) {
    mkdirSync(STT_OUTPUT_DIR, { recursive: true });
  }
}

export function getSttOutputDir(): string {
  ensureSttDir();
  return STT_OUTPUT_DIR;
}

export function getSttHistory(): STTHistoryEntry[] {
  ensureSttDir();
  if (!existsSync(STT_HISTORY_FILE)) {
    return [];
  }
  try {
    const raw = readFileSync(STT_HISTORY_FILE, "utf-8");
    return JSON.parse(raw) as STTHistoryEntry[];
  } catch (err) {
    console.error("Erreur lors de la lecture de stt_history.json:", err);
    return [];
  }
}

function saveSttHistory(entries: STTHistoryEntry[]): void {
  ensureSttDir();
  writeFileSync(STT_HISTORY_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

export function saveSttAudioAndResult(
  buffer: Buffer | null,
  meta: {
    text: string;
    engine: "whisper" | "webspeech" | "sherpa";
    modelSize?: string;
    device?: string;
    language: string;
    durationSec: number;
    processingTimeMs: number;
    rtf: number;
    segments: STTSegment[];
    originalFilename?: string;
  }
): STTHistoryEntry {
  ensureSttDir();

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  let fileName: string | undefined = undefined;
  let filePath: string | undefined = undefined;
  let url: string | undefined = undefined;

  if (buffer && buffer.length > 0) {
    fileName = `${timestamp}_stt_${meta.engine}_${randomSuffix}.wav`;
    filePath = join(STT_OUTPUT_DIR, fileName);
    writeFileSync(filePath, buffer);
    url = `/audio/stt/${fileName}`;
  }

  const entry: STTHistoryEntry = {
    id: `stt-${Date.now()}-${randomSuffix}`,
    createdAt: now.toISOString(),
    text: meta.text,
    engine: meta.engine,
    modelSize: meta.modelSize,
    device: meta.device,
    language: meta.language,
    durationSec: meta.durationSec,
    processingTimeMs: meta.processingTimeMs,
    rtf: meta.rtf,
    filePath,
    fileName,
    url,
    segments: meta.segments,
    score: 0,
    isFavorite: false,
  };

  const history = getSttHistory();
  history.unshift(entry);
  saveSttHistory(history);

  return entry;
}

export function setSttScore(id: string, score: number): STTHistoryEntry | undefined {
  const history = getSttHistory();
  const entry = history.find((e) => e.id === id);
  if (!entry) return undefined;

  entry.score = Math.max(0, Math.min(3, Math.round(score)));
  saveSttHistory(history);
  return entry;
}

export function toggleSttFavorite(id: string): STTHistoryEntry | undefined {
  const history = getSttHistory();
  const entry = history.find((e) => e.id === id);
  if (!entry) return undefined;

  entry.isFavorite = !entry.isFavorite;
  saveSttHistory(history);
  return entry;
}

export function deleteSttHistoryItem(id: string): boolean {
  const history = getSttHistory();
  const index = history.findIndex((e) => e.id === id);
  if (index === -1) return false;

  const [removed] = history.splice(index, 1);
  if (removed?.filePath && existsSync(removed.filePath)) {
    try {
      unlinkSync(removed.filePath);
    } catch (err) {
      console.warn("Impossible de supprimer le fichier audio STT:", err);
    }
  }

  saveSttHistory(history);
  return true;
}

export function clearSttHistory(): void {
  const history = getSttHistory();
  for (const item of history) {
    if (item.filePath && existsSync(item.filePath)) {
      try {
        unlinkSync(item.filePath);
      } catch (err) {
        console.warn("Impossible de supprimer le fichier audio STT:", err);
      }
    }
  }
  saveSttHistory([]);
}
