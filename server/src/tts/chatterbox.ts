export interface ChatterboxReference {
  id: string;
  name: string;
  language?: string;
  gender?: "female" | "male" | "unknown";
}

const CHATTERBOX_URL = process.env.CHATTERBOX_URL || "http://127.0.0.1:5002";

export async function isChatterboxAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${CHATTERBOX_URL}/health`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return false;
    const data = (await res.json()) as { status?: string };
    return data.status === "ok";
  } catch {
    return false;
  }
}

export async function getChatterboxReferences(): Promise<ChatterboxReference[]> {
  try {
    const res = await fetch(`${CHATTERBOX_URL}/references`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = (await res.json()) as Array<{ id: string; name: string }>;
    return data.map((r) => {
      const lower = r.name.toLowerCase();
      let gender: "female" | "male" | "unknown" = "unknown";
      if (lower.includes("female") || lower.includes("femme")) gender = "female";
      else if (lower.includes("male") || lower.includes("homme")) gender = "male";

      return {
        id: r.id,
        name: r.name,
        language: "fr-FR",
        gender,
      };
    });
  } catch (err) {
    console.warn("[Chatterbox] Impossible de contacter le service Python:", err);
    // Voix de secours pré-configurées si le service charge encore
    return [
      { id: "reference_female.wav", name: "Voix Féminine (Clonage)", language: "fr-FR", gender: "female" },
      { id: "reference_male.wav", name: "Voix Masculine (Clonage)", language: "fr-FR", gender: "male" },
    ];
  }
}

export interface ChatterboxOptions {
  referenceName?: string;
  language?: string;
  device?: "cuda" | "cpu";
  exaggeration?: number;
  temperature?: number;
  repetitionPenalty?: number;
}

export async function synthesizeChatterbox(
  text: string,
  options: ChatterboxOptions = {}
): Promise<Buffer> {
  const payload = {
    text,
    language: options.language || "fr",
    reference_name: options.referenceName || "reference_female.wav",
    device: options.device || "cuda",
    exaggeration: options.exaggeration ?? 0.5,
    temperature: options.temperature ?? 0.8,
    repetition_penalty: options.repetitionPenalty ?? 2.0,
  };

  let res: Response;
  try {
    res = await fetch(`${CHATTERBOX_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // synthèse ou téléchargement initial
      signal: AbortSignal.timeout(300000),
    });
  } catch (err: any) {
    if (err?.cause?.code === "ECONNREFUSED" || err?.message?.includes("fetch failed")) {
      throw new Error(
        `Le micro-service Python Chatterbox n'est pas démarré (http://127.0.0.1:5002). Lancez 'npm run chatterbox' dans un terminal séparé.`
      );
    }
    throw err;
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Chatterbox error ${res.status}: ${errText || res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
