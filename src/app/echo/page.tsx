import type { Metadata } from "next";
import { EchoWorkbench } from "@/features/echo/echo-workbench";

export const metadata: Metadata = { title: "Écho" };

export default function EchoPage() {
  return <EchoWorkbench />;
}
