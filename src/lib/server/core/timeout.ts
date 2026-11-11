import "server-only";

// SECTION: Délai maximal pour les promesses qui n'acceptent pas d'AbortSignal (libs tierces).

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`${label} : délai de ${Math.round(timeoutMs / 1000)} s dépassé.`);
      err.name = "TimeoutError";
      reject(err);
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
