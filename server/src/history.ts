import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export interface AudioHistoryEntry {
  id: string;
  createdAt: string;
  text: string;
  engine: "piper" | "edge";
  voiceId: string;
  voiceName: string;
  filePath: string;
  fileName: string;
  url: string;
  format: "wav" | "mp3";
  sizeBytes: number;
  upvotes: number;
  isFavorite?: boolean;
}

const OUTPUT_DIR = join(import.meta.dirname, "..", "output");
const HISTORY_FILE = join(OUTPUT_DIR, "history.json");

function ensureOutputDir() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

export function getOutputDir(): string {
  ensureOutputDir();
  return OUTPUT_DIR;
}

export function getHistory(): AudioHistoryEntry[] {
  ensureOutputDir();
  if (!existsSync(HISTORY_FILE)) {
    return [];
  }
  try {
    const raw = readFileSync(HISTORY_FILE, "utf-8");
    return JSON.parse(raw) as AudioHistoryEntry[];
  } catch (err) {
    console.error("Erreur lors de la lecture de history.json:", err);
    return [];
  }
}

function saveHistory(entries: AudioHistoryEntry[]): void {
  ensureOutputDir();
  writeFileSync(HISTORY_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

export function saveAudio(
  buffer: Buffer,
  meta: {
    text: string;
    engine: "piper" | "edge";
    voiceId: string;
    voiceName: string;
    format: "wav" | "mp3";
  }
): AudioHistoryEntry {
  ensureOutputDir();

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  const safeVoiceId = meta.voiceId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${timestamp}_${meta.engine}_${safeVoiceId}_${randomSuffix}.${meta.format}`;
  const filePath = join(OUTPUT_DIR, fileName);

  writeFileSync(filePath, buffer);

  const entry: AudioHistoryEntry = {
    id: `${Date.now()}-${randomSuffix}`,
    createdAt: now.toISOString(),
    text: meta.text,
    engine: meta.engine,
    voiceId: meta.voiceId,
    voiceName: meta.voiceName,
    filePath,
    fileName,
    url: `/audio/${fileName}`,
    format: meta.format,
    sizeBytes: buffer.length,
    upvotes: 0,
    isFavorite: false,
  };

  const current = getHistory();
  // Limite à 50 entrées les plus récentes
  const updated = [entry, ...current].slice(0, 50);
  saveHistory(updated);

  return entry;
}

export function toggleUpvote(id: string): AudioHistoryEntry | null {
  const current = getHistory();
  const item = current.find((i) => i.id === id);
  if (!item) return null;

  item.isFavorite = !item.isFavorite;
  item.upvotes = (item.upvotes ?? 0) + (item.isFavorite ? 1 : -1);
  if (item.upvotes < 0) item.upvotes = 0;

  saveHistory(current);
  return item;
}

export function deleteHistoryItem(id: string): boolean {
  const current = getHistory();
  const index = current.findIndex((item) => item.id === id);
  if (index === -1) return false;

  const [item] = current.splice(index, 1);
  try {
    if (existsSync(item.filePath)) {
      unlinkSync(item.filePath);
    }
  } catch (err) {
    console.warn("Impossible de supprimer le fichier audio:", item.filePath, err);
  }

  saveHistory(current);
  return true;
}

export function clearHistory(): void {
  const current = getHistory();
  for (const item of current) {
    try {
      if (existsSync(item.filePath)) {
        unlinkSync(item.filePath);
      }
    } catch {
      // Ignorer les erreurs lors du nettoyage de fichiers
    }
  }
  saveHistory([]);
}
