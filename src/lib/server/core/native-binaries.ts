import "server-only";
import { PROJECT_PATHS } from "./paths";

// SECTION: Environnement d'exécution des binaires natifs de bin/ (piper, espeak-ng et leurs .so).

export function nativeBinaryEnv(): NodeJS.ProcessEnv {
  const current = process.env.LD_LIBRARY_PATH;
  return { ...process.env, LD_LIBRARY_PATH: current ? `${PROJECT_PATHS.binDir}:${current}` : PROJECT_PATHS.binDir };
}
