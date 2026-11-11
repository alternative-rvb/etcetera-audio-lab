import "server-only";
import { join } from "node:path";

// SECTION: Chemins du projet, résolus depuis la racine (process.cwd() = dossier où tourne `next`).

const PROJECT_ROOT = process.cwd();

export const PROJECT_PATHS = {
  root: PROJECT_ROOT,
  binDir: join(PROJECT_ROOT, "bin"),
  piperVoicesDir: join(PROJECT_ROOT, "voices"),
  sherpaModelsDir: join(PROJECT_ROOT, "models", "sherpa"),
  outputDir: join(PROJECT_ROOT, "output"),
  ttsAudioDir: join(PROJECT_ROOT, "output"),
  sttAudioDir: join(PROJECT_ROOT, "output", "stt"),
  ttsHistoryFile: join(PROJECT_ROOT, "output", "history.json"),
  sttHistoryFile: join(PROJECT_ROOT, "output", "stt_history.json"),
  echoRoundsFile: join(PROJECT_ROOT, "output", "echo_rounds.json"),
  logsDir: join(PROJECT_ROOT, "output", "logs"),
} as const;

export const PYTHON_SERVICE_URL =
  process.env.AI_SERVICE_URL || process.env.CHATTERBOX_URL || "http://127.0.0.1:5002";

export const PYTHON_SERVICE_START_HINT =
  "Relancez l'app avec `npm run dev`, qui démarre aussi le service Python, ou lancez seulement `npm run ai-service` dans un second terminal.";
