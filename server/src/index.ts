import express from "express";
import { join } from "node:path";
import { listVoices as listPiperVoices, getVoice as getPiperVoice } from "./voices.js";
import { synthesize as synthesizePiper } from "./piper.js";
import { listEdgeVoices, synthesizeEdge, EDGE_VOICES } from "./edgeTts.js";
import { saveAudio, getHistory, deleteHistoryItem, clearHistory, getOutputDir, toggleUpvote } from "./history.js";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(express.json());
app.use("/audio", express.static(getOutputDir()));

type Engine = "piper" | "edge";

function parseEngine(value: unknown): Engine | undefined {
  return value === "piper" || value === "edge" ? value : undefined;
}

app.get("/api/voices", (req, res) => {
  const engine = parseEngine(req.query.engine) ?? "piper";
  const localeQuery = typeof req.query.locale === "string" ? req.query.locale : "fr-FR";
  const locale = localeQuery === "all" ? undefined : localeQuery;

  try {
    if (engine === "edge") {
      res.json(listEdgeVoices(locale));
      return;
    }
    res.json(listPiperVoices(locale));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/history", (_req, res) => {
  try {
    res.json(getHistory());
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/history/:id/upvote", (req, res) => {
  const updated = toggleUpvote(req.params.id);
  if (!updated) {
    res.status(404).json({ error: "Entrée non trouvée" });
    return;
  }
  res.json(updated);
});

app.delete("/api/history/:id", (req, res) => {
  const success = deleteHistoryItem(req.params.id);
  if (!success) {
    res.status(404).json({ error: "Entrée non trouvée" });
    return;
  }
  res.json({ ok: true });
});

app.delete("/api/history", (_req, res) => {
  clearHistory();
  res.json({ ok: true });
});

app.post("/api/tts", async (req, res) => {
  const { text, voiceId, engine: engineRaw, lengthScale, noiseScale, noiseW, ratePercent } = req.body ?? {};
  const engine = parseEngine(engineRaw) ?? "piper";

  if (typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "Le champ 'text' est requis." });
    return;
  }
  if (typeof voiceId !== "string") {
    res.status(400).json({ error: "Le champ 'voiceId' est requis." });
    return;
  }

  try {
    let audioBuffer: Buffer;
    let voiceName = voiceId;
    let format: "wav" | "mp3";

    if (engine === "edge") {
      audioBuffer = await synthesizeEdge(text, voiceId, { ratePercent });
      const edgeVoice = EDGE_VOICES.find((v) => v.id === voiceId);
      if (edgeVoice) voiceName = edgeVoice.name;
      format = "mp3";
    } else {
      audioBuffer = await synthesizePiper(text, voiceId, { lengthScale, noiseScale, noiseW });
      const piperVoice = getPiperVoice(voiceId);
      if (piperVoice) voiceName = piperVoice.name;
      format = "wav";
    }

    const entry = saveAudio(audioBuffer, {
      text: text.trim(),
      engine,
      voiceId,
      voiceName,
      format,
    });

    res.set("X-Audio-Id", entry.id);
    res.set("X-Audio-Path", entry.filePath);
    res.set("X-Audio-Url", entry.url);
    res.set("X-Audio-Engine", entry.engine);
    res.set("X-Audio-Voice-Id", entry.voiceId);
    res.set("X-Audio-Voice-Name", encodeURIComponent(entry.voiceName));
    res.set("Access-Control-Expose-Headers", "X-Audio-Id, X-Audio-Path, X-Audio-Url, X-Audio-Engine, X-Audio-Voice-Id, X-Audio-Voice-Name");

    if (format === "mp3") {
      res.set("Content-Type", "audio/mpeg");
    } else {
      res.set("Content-Type", "audio/wav");
    }

    res.send(audioBuffer);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

const webDist = join(import.meta.dirname, "..", "..", "web", "dist");
app.use(express.static(webDist));

app.listen(PORT, () => {
  console.log(`Serveur TTS-test démarré sur http://localhost:${PORT}`);
});
