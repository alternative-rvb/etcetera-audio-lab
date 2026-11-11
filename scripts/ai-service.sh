#!/usr/bin/env bash
set -euo pipefail

# SECTION: Lance le service Python (Chatterbox, Whisper sur CUDA, secours des moteurs Node) s'il est installé.
# NOTE: sans venv, on s'arrête proprement : `npm run dev` garde Next en marche, le service Python reste facultatif.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="$ROOT_DIR/python/.venv/bin/python"

if [ ! -x "$PYTHON_BIN" ]; then
  echo "Service Python non installé : Chatterbox et Whisper sur GPU resteront indisponibles."
  echo "Pour l'installer : npm run setup:chatterbox"
  exit 0
fi

cd "$ROOT_DIR/python"
exec "$PYTHON_BIN" app.py
