"use client";

import { HARDWARE_HINTS, HARDWARE_LABELS, type Hardware } from "@/lib/shared/hardware";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/client/cn";

// SECTION: Matériel de la mesure, mis en évidence quand ce n'est pas comparable à un VPS (GPU).

export function HardwareBadge({ hardware, className }: { hardware: Hardware; className?: string }) {
  return (
    <Tooltip label={HARDWARE_HINTS[hardware]} describe>
      <span
        tabIndex={0}
        className={cn(
          "inline-flex cursor-help items-center rounded border px-1 text-[0.7rem] font-medium leading-4",
          hardware === "gpu" ? "border-accent text-accent" : "border-line-strong text-muted",
          className
        )}
      >
        {HARDWARE_LABELS[hardware]}
      </span>
    </Tooltip>
  );
}

/** Interrupteur « Sans GPU » du Comparatif : écarte les mesures GPU pour ne comparer que ce qu'un VPS saurait faire. */
export function NoGpuFilter({ active, onChange, hiddenCount }: { active: boolean; onChange: (active: boolean) => void; hiddenCount: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      <button
        type="button"
        aria-pressed={active}
        onClick={() => onChange(!active)}
        className={cn(
          "rounded-full border px-2.5 py-1 font-medium transition",
          active ? "border-accent bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-ink" : "border-line text-muted hover:text-ink"
        )}
      >
        Sans GPU, comme le VPS
      </button>
      {active && hiddenCount > 0 && <span>{hiddenCount} mesure{hiddenCount > 1 ? "s" : ""} GPU masquée{hiddenCount > 1 ? "s" : ""}.</span>}
    </div>
  );
}
