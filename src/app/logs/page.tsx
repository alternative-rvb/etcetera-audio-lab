import type { Metadata } from "next";
import { parseLogSource } from "@/features/logs/log-source-param";
import { LogsExplorer } from "@/features/logs/logs-explorer";

export const metadata: Metadata = { title: "Logs" };

// NOTE: ?sources=piper ouvre directement l'onglet d'un provider, ?requestId=req_... isole une requête.
export default async function LogsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const requestedSource = first(params.sources)?.split(",")[0];
  return <LogsExplorer initialSource={parseLogSource(requestedSource)} initialRequestId={first(params.requestId) ?? null} />;
}
