import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/server/core/api-handler";
import { runSttTranscription } from "@/lib/server/providers/stt/stt-transcription-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler("/api/stt/transcribe", async (request) =>
  NextResponse.json({ entry: await runSttTranscription(request) })
);
