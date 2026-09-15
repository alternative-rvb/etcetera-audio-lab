import express from "express";
import { join } from "node:path";
import { listVoices as listPiperVoices, getVoice as getPiperVoice } from "./voices.js";
import { synthesize as synthesizePiper } from "./piper.js";
import { listEdgeVoices, synthesizeEdge, EDGE_VOICES } from "./edgeTts.js";
import { getKokoroVoices, getKokoroVoice, synthesizeKokoro, KOKORO_VOICES } from "./kokoro.js";
import { getChatterboxReferences, synthesizeChatterbox } from "./chatterbox.js";
import { saveAudio, getHistory, deleteHistoryItem, clearHistory, getOutputDir, toggleUpvote } from "./history.js";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(express.json());
app.use("/audio", express.static(getOutputDir()));

type Engine = "piper" | "edge" | "kokoro" | "chatterbox";

function parseEngine(value: unknown): Engine | undefined {
  return value === "piper" || value === "edge" || value === "kokoro" || value === "chatterbox" ? value : undefined;
}

app.get("/api/voices", async (req, res) => {
  const engine = parseEngine(req.query.engine) ?? "piper";
  const localeQuery = typeof req.query.locale === "string" ? req.query.locale : "fr-FR";
  const locale = localeQuery === "all" ? undefined : localeQuery;

  try {
    if (engine === "edge") {
      res.json(listEdgeVoices(locale));
      return;
    }
    if (engine === "kokoro") {
      res.json(getKokoroVoices(locale));
      return;
    }
    if (engine === "chatterbox") {
      const refs = await getChatterboxReferences();
      res.json(refs);
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
  const {
    text,
    voiceId,
    engine: engineRaw,
    lengthScale,
    noiseScale,
    noiseW,
    ratePercent,
    speed,
    device: chatterboxDeviceRaw,
    exaggeration,
    temperature,
    repetitionPenalty,
  } = req.body ?? {};

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
    } else if (engine === "kokoro") {
      const parsedSpeed = typeof speed === "number" ? speed : 1.0;
      audioBuffer = await synthesizeKokoro(text, voiceId, { speed: parsedSpeed });
      const kokoroVoice = getKokoroVoice(voiceId) || KOKORO_VOICES.find((v) => v.id === voiceId);
      if (kokoroVoice) voiceName = kokoroVoice.name;
      format = "wav";
    } else if (engine === "chatterbox") {
      const parsedExagg = typeof exaggeration === "number" ? exaggeration : 0.5;
      const parsedTemp = typeof temperature === "number" ? temperature : 0.8;
      const parsedRep = typeof repetitionPenalty === "number" ? repetitionPenalty : 2.0;
      const parsedDevice = chatterboxDeviceRaw === "cpu" ? "cpu" : "cuda";

      audioBuffer = await synthesizeChatterbox(text, {
        referenceName: voiceId,
        language: "fr",
        device: parsedDevice,
        exaggeration: parsedExagg,
        temperature: parsedTemp,
        repetitionPenalty: parsedRep,
      });

      const refs = await getChatterboxReferences();
      const matched = refs.find((r) => r.id === voiceId);
      if (matched) voiceName = matched.name;
      format = "wav";
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
    res.set(
      "Access-Control-Expose-Headers",
      "X-Audio-Id, X-Audio-Path, X-Audio-Url, X-Audio-Engine, X-Audio-Voice-Id, X-Audio-Voice-Name"
    );

    if (format === "mp3") {
      res.set("Content-Type", "audio/mpeg");
    } else {
      res.set("Content-Type", "audio/wav");
    }

    res.send(audioBuffer);
  } catch (err) {
    console.error(`[API /tts] Erreur (${engine}):`, err);
    res.status(500).json({ error: (err as Error).message });
  }
});

const webDist = join(import.meta.dirname, "..", "..", "web", "dist");
app.use(express.static(webDist));

app.listen(PORT, () => {
  console.log(`Serveur TTS-test démarré sur http://localhost:${PORT}`);
});
