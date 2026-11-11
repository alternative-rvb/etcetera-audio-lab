#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PYTHON_DIR="$ROOT_DIR/python"
VENV_DIR="$PYTHON_DIR/.venv"

echo "=== Configuration de l'environnement Chatterbox TTS ==="

# NOTE: uv fixe Python 3.12 (torch 2.6 imposé par chatterbox n'existe pas pour les versions plus récentes),
# l'environnement ne casse donc plus à chaque montée de version du Python système.
if ! command -v uv >/dev/null 2>&1; then
  echo "uv introuvable : installez-le (https://docs.astral.sh/uv/) puis relancez ce script."
  exit 1
fi

if [ ! -d "$VENV_DIR" ]; then
  echo "Création de l'environnement virtuel Python 3.12 dans $VENV_DIR..."
  uv venv --python 3.12 "$VENV_DIR"
fi

echo "Installation des dépendances Python..."
uv pip install --python "$VENV_DIR/bin/python" -r "$PYTHON_DIR/requirements.txt"

echo "Vérification de l'installation..."
"$VENV_DIR/bin/python" -c "import chatterbox, torch; print('Chatterbox OK, PyTorch version:', torch.__version__, 'CUDA:', torch.cuda.is_available())"

echo "=== Chatterbox configuré avec succès ! ==="
