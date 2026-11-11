"use client";

import type { RuntimeTrace } from "@/lib/shared/types";
import { Icon } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/client/cn";

// SECTION: Où un audio ou une transcription a été produit (dans l'app, service Python, binaire Piper), et si le secours a servi.

const RUNTIME_LABELS = {
  node: { label: "App", tooltip: "Exécuté directement dans l'app (Node, sherpa-onnx)." },
  python: { label: "Python", tooltip: "Exécuté par le service Python." },
  binary: { label: "Binaire", tooltip: "Exécuté par le binaire Piper." },
} as const;

export function RuntimeBadge({ trace, className }: { trace: RuntimeTrace; className?: string }) {
  if (!trace.runtime) return null;
  const { label, tooltip } = RUNTIME_LABELS[trace.runtime];
  const text = trace.fallback ? `${label}, secours` : label;
  const description = trace.fallback ? `${tooltip} L'exécution dans l'app a échoué, le secours a pris le relais : voir les logs.` : tooltip;
  return (
    <Tooltip label={description} describe>
      <span tabIndex={0} className={cn("inline-flex cursor-help items-center gap-0.5 text-xs", trace.fallback ? "text-warning" : "text-muted", className)}>
        {trace.fallback && <Icon name="warning" size={14} />}
        {text}
      </span>
    </Tooltip>
  );
}
