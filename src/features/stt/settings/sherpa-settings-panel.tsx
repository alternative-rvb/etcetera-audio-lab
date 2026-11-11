"use client";

// SECTION: Réglages Sherpa-ONNX : un seul modèle (Parakeet TDT 0.6B v3) qui détecte la langue seul, donc rien à régler.

export function SherpaSettingsPanel() {
  return (
    <p className="text-xs text-muted">
      Modèle Parakeet TDT 0.6B v3 : 25 langues européennes, langue détectée automatiquement, exécuté dans l'app sur CPU. Si le modèle manque, Whisper tiny du
      service Python prend le relais.
    </p>
  );
}
