import { NextResponse } from "next/server";
import { requireFound, withApiHandler } from "@/lib/server/core/api-handler";
import { toggleTtsFavorite } from "@/lib/server/history/tts-history-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler<{ id: string }>("/api/tts/history/[id]/favorite", async (_request, { params }) =>
  NextResponse.json(requireFound(toggleTtsFavorite(params.id), "Entrée d'historique"))
);
