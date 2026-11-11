import { z } from "zod";

// ANCHOR: note sur 3 commune aux historiques TTS et STT (0 = non noté).
export const scoreBodySchema = z.object({ score: z.number().int().min(0).max(3) });
