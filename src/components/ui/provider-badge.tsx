import type { ReactNode } from "react";
import type { LogSource } from "@/lib/shared/types";
import { LOG_SOURCE_LABELS } from "@/lib/shared/provider-catalog";
import { providerStyle } from "@/lib/client/provider-style";
import { cn } from "@/lib/client/cn";

// ANCHOR: pastille colorée au nom d'un provider (ou d'une source de logs).
export function ProviderBadge({ provider, children, className }: { provider: LogSource; children?: ReactNode; className?: string }) {
  return (
    <span
      style={providerStyle(provider)}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-[color-mix(in_srgb,var(--provider)_40%,transparent)] bg-[color-mix(in_srgb,var(--provider)_12%,transparent)] px-1.5 py-0.5 text-[0.7rem] font-semibold whitespace-nowrap text-[var(--provider)]",
        className
      )}
    >
      {children ?? LOG_SOURCE_LABELS[provider]}
    </span>
  );
}
