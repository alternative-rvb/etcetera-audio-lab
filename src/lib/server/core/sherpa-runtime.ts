import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type * as Sherpa from "sherpa-onnx-node";
import { AppError, type ProviderId } from "./errors";
import { PROJECT_PATHS } from "./paths";

// SECTION: Accès à sherpa-onnx-node (module natif chargé à la demande) et à ses modèles de models/sherpa/.
// NOTE: les instances de moteur sont lourdes à créer (plusieurs centaines de Mo pour Parakeet) : on les garde en cache.

export const SHERPA_SETUP_HINT = "Lancez `npm run setup:sherpa` pour télécharger les modèles sherpa-onnx.";

type SherpaModule = typeof Sherpa;
let sherpaModule: Promise<SherpaModule> | null = null;

export async function loadSherpa(provider: ProviderId): Promise<SherpaModule> {
  sherpaModule ??= import("sherpa-onnx-node").then((mod) => ((mod as { default?: SherpaModule }).default ?? mod) as SherpaModule);
  try {
    return await sherpaModule;
  } catch (err) {
    sherpaModule = null;
    throw new AppError("ENGINE_UNAVAILABLE", "Module sherpa-onnx-node impossible à charger.", {
      provider,
      hint: "Lancez `npm install` pour installer sherpa-onnx-node.",
      cause: err,
    });
  }
}

/** Chemin d'un fichier de models/sherpa/, ou erreur ENGINE_UNAVAILABLE s'il manque. */
export function sherpaModelPath(provider: ProviderId, ...segments: string[]): string {
  const path = join(PROJECT_PATHS.sherpaModelsDir, ...segments);
  if (!existsSync(path)) {
    throw new AppError("ENGINE_UNAVAILABLE", `Modèle sherpa-onnx absent : models/sherpa/${segments.join("/")}.`, {
      provider,
      hint: SHERPA_SETUP_HINT,
    });
  }
  return path;
}

export function hasSherpaModel(...segments: string[]): boolean {
  return existsSync(join(PROJECT_PATHS.sherpaModelsDir, ...segments));
}

/** Cache de promesses par clé : une instance par configuration, retirée du cache si sa création échoue. */
export function createInstanceCache<T>() {
  const instances = new Map<string, Promise<T>>();
  return {
    get(key: string, create: () => Promise<T>): Promise<T> {
      let instance = instances.get(key);
      if (!instance) {
        instance = create().catch((err) => {
          instances.delete(key);
          throw err;
        });
        instances.set(key, instance);
      }
      return instance;
    },
    keys: () => [...instances.keys()],
  };
}

/** Nombre de threads CPU donnés à un moteur, sans monopoliser la machine. */
export const SHERPA_NUM_THREADS = 4;
