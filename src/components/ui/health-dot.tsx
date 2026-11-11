import type { ProviderHealth } from "@/lib/shared/types";
import { cn } from "@/lib/client/cn";

// ANCHOR: témoin d'état d'un provider (vert ok, orange dégradé, rouge indisponible, gris inconnu).
const STATUS_CLASSES = {
  ok: "bg-success",
  degraded: "bg-warning",
  down: "bg-danger",
  unknown: "bg-line-strong",
} as const;

const STATUS_LABELS = { ok: "Disponible", degraded: "Fonctionnement dégradé", down: "Indisponible", unknown: "État inconnu" } as const;

export function healthLabel(health?: ProviderHealth): string {
  const status = health?.status ?? "unknown";
  return [STATUS_LABELS[status], health?.reason].filter(Boolean).join(" : ");
}

export function HealthDot({ health, className }: { health?: ProviderHealth; className?: string }) {
  const status = health?.status ?? "unknown";
  return (
    <span
      role="img"
      aria-label={healthLabel(health)}
      title={healthLabel(health)}
      className={cn("inline-block size-2 shrink-0 rounded-full retro:shadow-[0_0_8px_currentColor]", STATUS_CLASSES[status], className)}
    />
  );
}
