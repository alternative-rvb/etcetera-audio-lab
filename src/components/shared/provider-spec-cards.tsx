import type { LogSource, ProviderHealth } from "@/lib/shared/types";
import type { ProviderSpec } from "@/lib/shared/provider-catalog";
import { HealthDot, healthLabel } from "@/components/ui/health-dot";
import { HintText } from "@/components/ui/hint-text";
import { providerStyle } from "@/lib/client/provider-style";

// SECTION: Fiches techniques comparatives des providers (stack, prérequis, licence, sortie, état).

export function ProviderSpecCards<P extends LogSource>({
  catalog,
  health,
  only,
}: {
  catalog: Record<P, ProviderSpec>;
  health?: Partial<Record<P, ProviderHealth>>;
  /** N'affiche que la fiche de ce provider (fiche du moteur sélectionné). */
  only?: P;
}) {
  const providers = only ? [only] : (Object.keys(catalog) as P[]);
  return (
    <div className={only ? "grid" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-4"}>
      {providers.map((provider) => {
        const spec = catalog[provider];
        const providerHealth = health?.[provider];
        return (
          <article key={provider} style={providerStyle(provider)} className="relative overflow-hidden rounded-xl border border-line bg-sunken/60 py-3 pr-3 pl-4">
            <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[var(--provider)]" />
            <header className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-ink">{spec.label}</h3>
                <p className="text-xs text-[var(--provider)]">{spec.tagline}</p>
              </div>
              <HealthDot health={providerHealth} className="mt-1.5" />
            </header>
            <p className="mt-1.5 text-sm text-muted">{spec.description}</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted">Stack</dt>
              <dd className="text-ink">{spec.stack}</dd>
              <dt className="text-muted">Prérequis</dt>
              <dd className="text-ink">{spec.requirements.join(" ; ")}</dd>
              <dt className="text-muted">Licence</dt>
              <dd className="text-ink">{spec.license}</dd>
              {spec.output && (
                <>
                  <dt className="text-muted">Sortie</dt>
                  <dd className="text-ink">{spec.output}</dd>
                </>
              )}
              <dt className="text-muted">État</dt>
              <dd className="text-ink">{healthLabel(providerHealth)}</dd>
            </dl>
            {providerHealth?.hint && providerHealth.status !== "ok" && (
              <p className="mt-2 rounded-md bg-warning/10 px-2 py-1 text-xs text-warning"><HintText text={providerHealth.hint} /></p>
            )}
          </article>
        );
      })}
    </div>
  );
}
