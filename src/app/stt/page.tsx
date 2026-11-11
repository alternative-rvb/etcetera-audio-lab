import type { Metadata } from "next";
import { SttWorkbench } from "@/features/stt/stt-workbench";

export const metadata: Metadata = { title: "Transcription" };

export default function SttPage() {
  return <SttWorkbench />;
}
