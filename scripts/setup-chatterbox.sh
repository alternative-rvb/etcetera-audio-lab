#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PYTHON_DIR="$ROOT_DIR/python"
VENV_DIR="$PYTHON_DIR/.venv"

echo "=== Configuration de l'environnement Chatterbox TTS ==="

if [ ! -d "$VENV_DIR" ]; then
  echo "Création de l'environnement virtuel Python dans $VENV_DIR..."
  python3 -m venv "$VENV_DIR"
fi

echo "Installation des dépendances Python..."
"$VENV_DIR/bin/pip" install --upgrade pip
"$VENV_DIR/bin/pip" install -r "$PYTHON_DIR/requirements.txt"

echo "Vérification de l'installation..."
"$VENV_DIR/bin/python" -c "import chatterbox, torch; print('Chatterbox OK, PyTorch version:', torch.__version__, 'CUDA:', torch.cuda.is_available())"

echo "=== Chatterbox configuré avec succès ! ==="
