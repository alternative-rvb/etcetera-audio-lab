"use client";

import { Icon } from "@/components/ui/icon";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { reportBrowserLog } from "@/lib/client/browser-logger";

// SECTION: Erreur de rendu d'une page : tracée dans les logs, avec possibilité de réessayer.

export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportBrowserLog("error", "browser", "render.crashed", `Plantage de l'interface : ${error.message}`, {
      error,
      meta: { digest: error.digest, path: window.location.pathname },
    });
  }, [error]);

  return (
    <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-danger/40 bg-surface p-6">
      <h1 className="text-lg font-semibold text-ink">Cette page a rencontré une erreur</h1>
      <p className="mt-2 text-sm text-muted">{error.message}</p>
      <p className="mt-1 text-xs text-muted">Le détail a été enregistré dans les logs (source Navigateur).</p>
      <div className="mt-5 flex gap-2">
        <Button variant="primary" icon={<Icon name="reset" />} onClick={reset}>
          Réessayer
        </Button>
        <Button onClick={() => window.location.assign("/logs?sources=browser")}>Ouvrir les logs</Button>
      </div>
    </div>
  );
}
