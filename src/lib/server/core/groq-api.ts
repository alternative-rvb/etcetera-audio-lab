import "server-only";

// SECTION: Socle commun des appels à l'API Groq (transcription audio et analyse de texte).
// NOTE: la clé GROQ_API_KEY est lue dans .env.local (chargé par Next), jamais exposée au navigateur.

export const GROQ_API_BASE = "https://api.groq.com/openai/v1";
export const GROQ_KEY_HINT = "Ajoutez GROQ_API_KEY=... dans .env.local à la racine du projet, puis relancez `npm run dev`.";

export function readGroqApiKey(): string | undefined {
  return process.env.GROQ_API_KEY?.trim() || undefined;
}

/** Message d'erreur renvoyé par Groq (corps JSON `{ error: { message } }`), à défaut le code HTTP. */
export async function readGroqError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}
