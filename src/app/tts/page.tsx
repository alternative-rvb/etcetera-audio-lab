import type { Metadata } from "next";
import { TtsWorkbench } from "@/features/tts/tts-workbench";

export const metadata: Metadata = { title: "Synthèse vocale" };

export default function TtsPage() {
  return <TtsWorkbench />;
}
