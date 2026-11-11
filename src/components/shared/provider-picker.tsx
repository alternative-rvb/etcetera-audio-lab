"use client";

import type { LogSource, ProviderHealth } from "@/lib/shared/types";
import type { ProviderSpec } from "@/lib/shared/provider-catalog";
import { HealthDot, healthLabel } from "@/components/ui/health-dot";
import { Icon, type IconName } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { providerStyle } from "@/lib/client/provider-style";
import { cn } from "@/lib/client/cn";

// SECTION: Choix du provider (TTS ou STT), avec son état de santé (un provider indisponible reste sélectionnable, l'alerte explique pourquoi).

const RUNTIME_ICONS: Record<ProviderSpec["runtime"], IconName> = { cloud: "runtimeCloud", local: "runtimeLocal", browser: "runtimeBrowser" };

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
        // NOTE: le sous-titre et l'état passent en infobulle, la carte tient sur une ligne.
        return (
          <Tooltip key={provider} label={`${spec.tagline}. ${healthLabel(providerHealth).replace(/\.$/, "")}.`}>
            <button
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(provider)}
              style={providerStyle(provider)}
              className={cn(
                "flex h-9 min-w-0 items-center gap-1.5 rounded-lg border px-2.5 text-left text-sm transition disabled:cursor-not-allowed",
                active
                  ? "border-[var(--provider)] bg-[color-mix(in_srgb,var(--provider)_10%,var(--surface))] shadow-[inset_0_0_0_1px_var(--provider)]"
                  : "border-line bg-surface hover:border-line-strong",
                isDown && !active && "opacity-60"
              )}
            >
              <Icon name={RUNTIME_ICONS[spec.runtime]} size={17} className={active ? "text-[var(--provider)]" : "text-muted"} />
              <span className={cn("min-w-0 flex-1 truncate font-semibold", active ? "text-[var(--provider)]" : "text-ink")}>{spec.label}</span>
              <HealthDot health={providerHealth} tooltip={false} />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
