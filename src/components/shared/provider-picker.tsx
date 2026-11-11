"use client";

import type { LogSource, ProviderHealth } from "@/lib/shared/types";
import type { ProviderSpec } from "@/lib/shared/provider-catalog";
import { HealthDot } from "@/components/ui/health-dot";
import { providerStyle } from "@/lib/client/provider-style";
import { cn } from "@/lib/client/cn";

// SECTION: Choix du provider (TTS ou STT), avec son état de santé (un provider indisponible reste sélectionnable, l'alerte explique pourquoi).

export function ProviderPicker<P extends LogSource>({
  providers,
  catalog,
  value,
  onChange,
  health,
  disabled,
  label,
}: {
  providers: readonly P[];
  catalog: Record<P, ProviderSpec>;
  value: P;
  onChange: (provider: P) => void;
  health?: Partial<Record<P, ProviderHealth>>;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid grid-cols-2 gap-1.5", providers.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
      {providers.map((provider) => {
        const spec = catalog[provider];
        const active = provider === value;
        const providerHealth = health?.[provider];
        const isDown = providerHealth?.status === "down";
        return (
          <button
            key={provider}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(provider)}
            style={providerStyle(provider)}
            className={cn(
              "group relative flex min-w-0 flex-col items-start rounded-xl border px-2.5 py-2 text-left transition disabled:cursor-not-allowed",
              active
                ? "border-[var(--provider)] bg-[color-mix(in_srgb,var(--provider)_10%,var(--surface))] shadow-[inset_0_0_0_1px_var(--provider)] retro:shadow-[0_0_16px_color-mix(in_srgb,var(--provider)_45%,transparent)]"
                : "border-line bg-surface hover:border-line-strong",
              isDown && !active && "opacity-60"
            )}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className={cn("truncate font-semibold", active ? "text-[var(--provider)]" : "text-ink")}>{spec.label}</span>
              <HealthDot health={providerHealth} />
            </span>
            <span className="w-full truncate text-xs text-muted">{spec.tagline}</span>
          </button>
        );
      })}
    </div>
  );
}
