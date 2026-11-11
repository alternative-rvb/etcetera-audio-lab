#!/usr/bin/env bash
set -euo pipefail

# SECTION: Modèles sherpa-onnx exécutés en Node (Piper, Whisper CPU, Parakeet), téléchargés dans models/sherpa/.
# NOTE: option --whisper-medium pour ajouter Whisper medium (1,8 Go).

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODELS_DIR="$ROOT_DIR/models/sherpa"
TTS_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models"
ASR_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models"

ARCHIVES=(
  "$TTS_URL/vits-piper-fr_FR-siwis-medium.tar.bz2"
  "$TTS_URL/vits-piper-fr_FR-upmc-medium.tar.bz2"
  "$TTS_URL/vits-piper-fr_FR-tom-medium.tar.bz2"
  "$TTS_URL/vits-piper-fr_FR-gilles-low.tar.bz2"
  "$TTS_URL/vits-piper-en_US-lessac-medium.tar.bz2"
  "$ASR_URL/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2"
  "$ASR_URL/sherpa-onnx-whisper-tiny.tar.bz2"
  "$ASR_URL/sherpa-onnx-whisper-base.tar.bz2"
  "$ASR_URL/sherpa-onnx-whisper-small.tar.bz2"
)

for arg in "$@"; do
  if [ "$arg" = "--whisper-medium" ]; then
    ARCHIVES+=("$ASR_URL/sherpa-onnx-whisper-medium.tar.bz2")
  fi
done

mkdir -p "$MODELS_DIR"

for url in "${ARCHIVES[@]}"; do
  name="$(basename "$url" .tar.bz2)"
  if [ -d "$MODELS_DIR/$name" ]; then
    echo "$name déjà présent, on passe."
    continue
  fi
  echo "Téléchargement de $name..."
  tmp_archive="$(mktemp)"
  curl -fSL --progress-bar "$url" -o "$tmp_archive"
  tar -xjf "$tmp_archive" -C "$MODELS_DIR"
  rm -f "$tmp_archive"
done

if [ ! -f "$MODELS_DIR/silero_vad.onnx" ]; then
  echo "Téléchargement de silero_vad.onnx..."
  curl -fSL --progress-bar "$ASR_URL/silero_vad.onnx" -o "$MODELS_DIR/silero_vad.onnx"
fi

# NOTE: les exemples et fichiers de test livrés dans les archives ne servent pas au labo.
find "$MODELS_DIR" -maxdepth 2 -type d -name "test_wavs" -exec rm -rf {} +

echo "Modèles sherpa-onnx prêts dans $MODELS_DIR"
