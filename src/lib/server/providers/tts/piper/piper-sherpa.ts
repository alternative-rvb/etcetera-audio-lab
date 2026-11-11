import "server-only";
import { join } from "node:path";
import type { OfflineTts } from "sherpa-onnx-node";
import type { PiperSettings } from "@/lib/shared/types";
import { AppError } from "@/lib/server/core/errors";
import { espeakToIpaLines } from "@/lib/server/core/espeak";
import { createInstanceCache, loadSherpa, SHERPA_NUM_THREADS, SHERPA_SETUP_HINT } from "@/lib/server/core/sherpa-runtime";
import { encodeFloat32MonoAsWav } from "@/lib/server/core/wav-encoding";
import type { PiperVoice } from "./piper-voice-catalog";

// SECTION: Piper exécuté en Node par sherpa-onnx-node (modèles VITS de models/sherpa/vits-piper-*).
// NOTE: depuis sherpa-onnx 2.0, le texte doit arriver déjà phonémisé : espeak-ng (bin/) fournit l'IPA,
// ponctuation de fin de proposition rajoutée comme le fait piper-phonemize, pour garder les pauses.

const ttsCache = createInstanceCache<OfflineTts>();
const CLAUSE_PUNCTUATION = /[,;:.!?]/g;
const SENTENCE_SPLIT = /(?<=[.!?])\s+/;
const PHONEMIZE_BATCH = 8;

async function phonemizeSentence(sentence: string, espeakVoice: string): Promise<number[]> {
  const clauses = await espeakToIpaLines(sentence, { voice: espeakVoice, ipaMode: "--ipa", provider: "piper" });
  const punctuation = sentence.match(CLAUSE_PUNCTUATION) ?? [];
  // NOTE: espeak renvoie une ligne par proposition ; si le compte ne colle pas avec la ponctuation, on ne garde que la finale.
  const aligned = clauses.length === punctuation.length || clauses.length === punctuation.length + 1;
  const phonemes = aligned
    ? clauses.map((clause, i) => `${clause}${punctuation[i] ?? ""}`).join(" ")
    : `${clauses.join(" ")}${punctuation.at(-1) ?? ""}`;
  return Array.from(phonemes, (char) => char.codePointAt(0) ?? 0);
}

async function phonemizeText(text: string, espeakVoice: string): Promise<number[][]> {
  const sentences = text.split(SENTENCE_SPLIT).map((s) => s.trim()).filter(Boolean);
  const result: number[][] = [];
  for (let i = 0; i < sentences.length; i += PHONEMIZE_BATCH) {
    const batch = await Promise.all(sentences.slice(i, i + PHONEMIZE_BATCH).map((s) => phonemizeSentence(s, espeakVoice)));
    result.push(...batch);
  }
  return result.filter((codepoints) => codepoints.length > 0);
}

export async function synthesizePiperWithSherpa(voice: PiperVoice, text: string, settings: PiperSettings): Promise<{ audio: Buffer; sampleRate: number }> {
  if (!voice.sherpaDir) {
    throw new AppError("ENGINE_UNAVAILABLE", `Voix ${voice.name} absente de models/sherpa/.`, { provider: "piper", hint: SHERPA_SETUP_HINT });
  }
  const sherpaDir = voice.sherpaDir;
  const sherpa = await loadSherpa("piper");
  const key = `${voice.id}|${settings.lengthScale}|${settings.noiseScale}|${settings.noiseW}`;
  const tts = await ttsCache.get(key, () =>
    sherpa.OfflineTts.createAsync({
      model: {
        vits: {
          model: join(sherpaDir, `${voice.id}.onnx`),
          tokens: join(sherpaDir, "tokens.txt"),
          lengthScale: settings.lengthScale,
          noiseScale: settings.noiseScale,
          noiseScaleW: settings.noiseW,
        },
        numThreads: SHERPA_NUM_THREADS,
        provider: "cpu",
        debug: false,
      },
      maxNumSentences: 1,
    })
  );

  const phonemeCodepoints = await phonemizeText(text, voice.espeakVoice);
  if (phonemeCodepoints.length === 0) {
    throw new AppError("VALIDATION", "Aucun phonème produit pour ce texte.", { provider: "piper" });
  }
  let generated;
  try {
    generated = await tts.generateAsync({
      text: "",
      enableExternalBuffer: false,
      generationConfig: new sherpa.GenerationConfig({ phonemeCodepoints, sid: 0, speed: 1, silenceScale: 0.2 }),
    });
  } catch (err) {
    throw new AppError("ENGINE_FAILED", "La synthèse Piper (sherpa-onnx) a échoué.", { provider: "piper", cause: err });
  }
  if (generated.samples.length === 0) {
    throw new AppError("ENGINE_FAILED", "Piper (sherpa-onnx) n'a produit aucun échantillon audio.", { provider: "piper" });
  }
  return { audio: encodeFloat32MonoAsWav(generated.samples, generated.sampleRate), sampleRate: generated.sampleRate };
}
