import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

// SECTION: Contexte de requête propagé automatiquement (requestId) à tous les logs émis pendant la requête.

export interface RequestContext {
  requestId: string;
  route: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function createRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const CLIENT_REQUEST_ID_PATTERN = /^req_[a-z0-9_]{6,40}$/;

/** Reprend l'identifiant envoyé par le navigateur (suivi en direct dans le panneau Activité), sinon en crée un. */
export function resolveRequestId(clientRequestId: string | null): string {
  return clientRequestId && CLIENT_REQUEST_ID_PATTERN.test(clientRequestId) ? clientRequestId : createRequestId();
}
