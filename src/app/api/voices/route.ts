import { NextResponse } from "next/server";
import { z } from "zod";
import { TTS_PROVIDER_IDS } from "@/lib/shared/types";
import { withApiHandler } from "@/lib/server/core/api-handler";
import { getTtsProvider } from "@/lib/server/providers/tts/tts-provider-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const voicesQuerySchema = z.object({
  provider: z.enum(TTS_PROVIDER_IDS),
  locale: z.string().default("fr-FR"),
});

export const GET = withApiHandler("/api/voices", async (request) => {
  const query = voicesQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  return NextResponse.json(await getTtsProvider(query.provider).listVoices(query.locale));
});
