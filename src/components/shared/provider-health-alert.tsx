"use client";

import type { ProviderHealth } from "@/lib/shared/types";
import { CopyButton } from "@/components/ui/feedback-controls";
import { HintText } from "@/components/ui/hint-text";
import { Icon } from "@/components/ui/icon";

// SECTION: Alerte compacte d'un moteur en panne ou dégradé : la cause, puis les commandes à lancer, copiables.
// NOTE: pas de nom de moteur en préfixe, il est sélectionné juste au-dessus ; la phrase d'aide disparaît au profit des commandes.

/** Commandes `entre backticks` d'un hint serveur. */
function extractCommands(hint: string | undefined): string[] {
  return [...(hint ?? "").matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

export function ProviderHealthAlert({ health }: { health?: ProviderHealth }) {
  if (!health || health.status === "ok") return null;
  const commands = extractCommands(health.hint);

  return (
    <div role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-sm text-warning">
      <Icon name="warning" />
      <span className="min-w-0">{health.reason ?? "Fonctionnement dégradé."}</span>
      {commands.length > 0 ? (
        <span className="ml-auto flex flex-wrap items-center gap-1">
          {commands.map((command) => (
            <span key={command} className="inline-flex items-center rounded-md bg-[color-mix(in_srgb,currentColor_12%,transparent)] pl-1.5 text-xs">
              <code className="font-mono">{command}</code>
              <CopyButton text={command} label={`Copier la commande ${command}`} />
            </span>
          ))}
        </span>
      ) : (
        health.hint && (
          <span className="w-full text-xs">
            <HintText text={health.hint} />
          </span>
        )
      )}
    </div>
  );
}
