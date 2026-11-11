import "server-only";
import { z } from "zod";
import { LOG_LEVELS, LOG_SOURCES } from "@/lib/shared/types";
import type { LogQuery } from "./core/logger";

// SECTION: Lecture des filtres de logs depuis l'URL (?sources=piper,kokoro&minLevel=warn&requestId=...).

const logQuerySchema = z.object({
  sources: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : undefined))
    .pipe(z.array(z.enum(LOG_SOURCES)).optional()),
  minLevel: z.enum(LOG_LEVELS).optional(),
  requestId: z.string().max(64).optional(),
  search: z.string().max(200).optional(),
  afterSeq: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
});

export function parseLogQuery(searchParams: URLSearchParams): LogQuery {
  return logQuerySchema.parse(Object.fromEntries(searchParams));
}
