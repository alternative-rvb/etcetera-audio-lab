import type { CSSProperties } from "react";
import type { LogSource } from "@/lib/shared/types";
import { providerColorVar } from "@/lib/shared/provider-catalog";

// ANCHOR: définit la variable CSS --provider, reprise par les boutons, curseurs et badges enfants.
export function providerStyle(provider: LogSource): CSSProperties {
  return { "--provider": providerColorVar(provider) } as CSSProperties;
}
