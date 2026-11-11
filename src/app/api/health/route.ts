import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/server/core/api-handler";
import { buildHealthReport } from "@/lib/server/health-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiHandler("/api/health", async () => NextResponse.json(await buildHealthReport()), { quiet: true });
