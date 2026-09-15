#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$ROOT_DIR/server/bin"
VOICES_DIR="$ROOT_DIR/server/voices"

PIPER_VERSION="2023.11.14-2"
PIPER_ARCHIVE_URL="https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}/piper_linux_x86_64.tar.gz"

VOICES_BASE_URL="https://huggingface.co/rhasspy/piper-voices/resolve/main"
VOICES=(
  "fr/fr_FR/siwis/medium/fr_FR-siwis-medium"
  "fr/fr_FR/upmc/medium/fr_FR-upmc-medium"
  "fr/fr_FR/tom/medium/fr_FR-tom-medium"
  "fr/fr_FR/gilles/low/fr_FR-gilles-low"
  "en/en_US/lessac/medium/en_US-lessac-medium"
)

mkdir -p "$BIN_DIR" "$VOICES_DIR"

if [ ! -x "$BIN_DIR/piper" ]; then
  echo "Téléchargement du binaire Piper ${PIPER_VERSION}..."
  TMP_ARCHIVE="$(mktemp)"
  curl -sL "$PIPER_ARCHIVE_URL" -o "$TMP_ARCHIVE"
  tar -xzf "$TMP_ARCHIVE" -C "$BIN_DIR" --strip-components=1
  rm -f "$TMP_ARCHIVE"
  chmod +x "$BIN_DIR/piper"
  echo "Binaire Piper installé dans $BIN_DIR/piper"
else
  echo "Binaire Piper déjà présent, on passe."
fi

for voice in "${VOICES[@]}"; do
  name="$(basename "$voice")"
  onnx_path="$VOICES_DIR/${name}.onnx"
  json_path="$VOICES_DIR/${name}.onnx.json"

  if [ ! -f "$onnx_path" ]; then
    echo "Téléchargement de la voix ${name}..."
    curl -sL "${VOICES_BASE_URL}/${voice}.onnx" -o "$onnx_path"
    curl -sL "${VOICES_BASE_URL}/${voice}.onnx.json" -o "$json_path"
  else
    echo "Voix ${name} déjà présente, on passe."
  fi
done

echo "Setup Piper terminé."
