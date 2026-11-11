import { NextResponse } from "next/server";
import { requireFound, withApiHandler } from "@/lib/server/core/api-handler";
import { toggleSttFavorite } from "@/lib/server/history/stt-history-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiHandler<{ id: string }>("/api/stt/history/[id]/favorite", async (_request, { params }) =>
  NextResponse.json(requireFound(toggleSttFavorite(params.id), "Entrée d'historique"))
);
