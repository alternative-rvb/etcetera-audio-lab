import { mkdir, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, withApiHandler } from "@/lib/server/core/api-handler";
import { PROJECT_PATHS } from "@/lib/server/core/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ANCHOR: PUT /api/echo/rounds → copie des mesures de la page Écho dans output/echo_rounds.json.
// NOTE: les mesures vivent dans le navigateur (localStorage) ; cette copie les rend lisibles côté serveur pour les analyser.
// Le fichier ne garde que moteurs, voix, mode, note et temps : ni phrase transcrite, ni réponse de l'IA. Il reste dans output/, non versionné.
const ms = z.number().finite().nonnegative().optional();
const roundSchema = z.object({
  id: z.string().max(64),
  createdAt: z.string().max(40),
  sttProvider: z.string().max(40),
  ttsProvider: z.string().max(40),
  voiceName: z.string().max(80),
  mode: z.enum(["echo", "ai"]).optional(),
  score: z.number().min(0).max(3),
  fallback: z.boolean(),
  times: z.object({ sttMs: ms, llmMs: ms, ttsMs: ms, delayMs: ms, latencyMs: ms, playbackMs: ms, totalMs: ms, sttServerMs: ms, ttsServerMs: ms }),
});

export const PUT = withApiHandler(
  "/api/echo/rounds",
  async (request) => {
    const rounds = await parseJsonBody(request, z.array(roundSchema).max(200));
    await mkdir(PROJECT_PATHS.outputDir, { recursive: true });
    await writeFile(PROJECT_PATHS.echoRoundsFile, JSON.stringify(rounds, null, 2), "utf8");
    return NextResponse.json({ saved: rounds.length });
  },
  { quiet: true }
);
