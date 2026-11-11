import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/server/core/api-handler";
import { AppError } from "@/lib/server/core/errors";
import { PROJECT_PATHS } from "@/lib/server/core/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SECTION: Service des fichiers audio de output/ (TTS) et output/stt/ (STT), avec support des requêtes Range
// pour que le lecteur puisse se positionner dans le fichier.

const AUDIO_MIME_TYPES: Record<string, string> = {
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".flac": "audio/flac",
};

function resolveAudioFile(segments: string[]): string {
  const root = resolve(PROJECT_PATHS.outputDir);
  const filePath = resolve(root, ...segments);
  if (!filePath.startsWith(root + sep)) throw new AppError("NOT_FOUND", "Fichier audio introuvable.");
  if (!AUDIO_MIME_TYPES[extname(filePath).toLowerCase()]) throw new AppError("NOT_FOUND", "Type de fichier non servi.");
  if (!existsSync(filePath)) throw new AppError("NOT_FOUND", "Fichier audio introuvable (supprimé de output/ ?).");
  return filePath;
}

export const GET = withApiHandler<{ path: string[] }>(
  "/audio/[...path]",
  async (request: NextRequest, { params }) => {
    const filePath = resolveAudioFile(params.path);
    const size = statSync(filePath).size;
    const contentType = AUDIO_MIME_TYPES[extname(filePath).toLowerCase()];
    const range = request.headers.get("range");

    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      const start = match?.[1] ? Number(match[1]) : 0;
      const end = match?.[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      if (start >= size || start > end) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      }
      const body = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
      return new Response(body, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
        },
      });
    }

    const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
    return new Response(body, {
      headers: { "Content-Type": contentType, "Content-Length": String(size), "Accept-Ranges": "bytes", "Cache-Control": "no-cache" },
    });
  },
  { quiet: true }
);
