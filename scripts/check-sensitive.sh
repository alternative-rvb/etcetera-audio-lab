#!/usr/bin/env bash
set -uo pipefail

# SECTION: Garde contre l'indexation de fichiers ou de données sensibles (appelée par .githooks/pre-commit).
# NOTE: vérifie l'index git (fichiers stagés et lignes ajoutées), jamais la copie de travail.
# NOTE: motifs privés supplémentaires, une expression régulière étendue par ligne, dans .git/info/sensitive-patterns (jamais versionné).

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR" || exit 1

failed=0
report() {
  echo "  ✗ $1" >&2
  failed=1
}

# ANCHOR: fichiers qui ne doivent jamais être indexés, même forcés avec git add -f.
BLOCKED_PATHS='(^|/)\.env($|\.)|\.(pem|key|p12|pfx|keystore|jks)$|(^|/)id_(rsa|ed25519|ecdsa)|(^|/)credentials(\.json)?$|^output/|^models/|^voices/|^bin/|^\.doc/|^\.venv/|(^|/)CLAUDE\.local\.md$|(^|/)\.playwright-(cli|mcp)/'
ALLOWED_PATHS='(^|/)\.env\.example$'

while IFS= read -r file; do
  [ -z "$file" ] && continue
  if [[ "$file" =~ $BLOCKED_PATHS ]] && ! [[ "$file" =~ $ALLOWED_PATHS ]]; then
    report "fichier sensible indexé: $file"
  fi
done < <(git diff --cached --name-only --diff-filter=ACMR)

# ANCHOR: secrets reconnaissables dans les lignes ajoutées.
SECRET_PATTERNS=(
  'gsk_[A-Za-z0-9]{20,}'
  'sk-(proj-)?[A-Za-z0-9_-]{20,}'
  'sk-ant-[A-Za-z0-9_-]{20,}'
  'hf_[A-Za-z0-9]{20,}'
  'AKIA[0-9A-Z]{16}'
  'gh[pousr]_[A-Za-z0-9]{30,}'
  'github_pat_[A-Za-z0-9_]{30,}'
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  '(GROQ|OPENAI|ANTHROPIC|HF|HUGGINGFACE)_[A-Z_]*(KEY|TOKEN)[[:space:]]*=[[:space:]]*[^[:space:]$]'
)

PRIVATE_PATTERNS_FILE="$(git rev-parse --git-path info/sensitive-patterns)"
if [ -f "$PRIVATE_PATTERNS_FILE" ]; then
  while IFS= read -r pattern; do
    [[ -z "$pattern" || "$pattern" == \#* ]] && continue
    SECRET_PATTERNS+=("$pattern")
  done < "$PRIVATE_PATTERNS_FILE"
fi

# NOTE: on ignore le script lui-même, qui contient les motifs en clair.
added_lines="$(git diff --cached -U0 --no-color --diff-filter=ACMR -- . ':(exclude)scripts/check-sensitive.sh' | grep -E '^\+[^+]' || true)"
if [ -n "$added_lines" ]; then
  for pattern in "${SECRET_PATTERNS[@]}"; do
    matches="$(printf '%s\n' "$added_lines" | grep -inE -e "$pattern" | head -3 || true)"
    if [ -n "$matches" ]; then
      report "contenu sensible (motif: $pattern)"
      # NOTE: on n'affiche que le début de la ligne pour ne pas recopier un secret entier dans le terminal.
      printf '%s\n' "$matches" | cut -c1-40 | sed 's/^/      /' >&2
    fi
  done
fi

if [ "$failed" -ne 0 ]; then
  echo "" >&2
  echo "Commit bloqué: retirez ces éléments de l'index (git restore --staged <fichier>) ou du contenu, puis recommencez." >&2
  echo "En cas de faux positif avéré, et seulement dans ce cas: git commit --no-verify." >&2
  exit 1
fi
exit 0
