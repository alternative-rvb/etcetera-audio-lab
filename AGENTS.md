# Etcetera Audio Lab

Banc d'essai open source (licence MIT) de moteurs de synthèse vocale (TTS) et de reconnaissance vocale (STT), centré sur le français. Une app Next.js compare dans une même interface des moteurs locaux, cloud et navigateur, et mesure pour chaque essai la qualité perçue, le temps de traitement et le moteur réellement utilisé.

Ce fichier sert aux agents de code: il décrit l'installation pas à pas, la vérification, le dépannage, puis l'architecture et les conventions à respecter pour modifier le projet. La présentation générale est dans [README.md](README.md).

## Installation

### Accompagner une installation

Quand une personne demande de l'aide pour installer le projet, il faut vérifier chaque prérequis par une commande avant de lancer quoi que ce soit, signaler ce qui manque avec la commande d'installation adaptée à son système, et lui demander son accord avant toute installation système (`apt`, `brew`, `winget`, etc.). Le service Python et la clé Groq sont facultatifs: les proposer, pas les imposer.

### Prérequis

| Élément | Vérification | Obligatoire | Remarque |
| ------- | ------------ | ----------- | -------- |
| Linux x86_64 ou WSL2 | `uname -sm` | Oui | `scripts/setup-piper.sh` télécharge `piper_linux_x86_64`, qui fournit aussi espeak-ng. Sur macOS ou ARM, Piper et Kokoro en Node échouent sans adaptation du script. |
| Node.js 20.9 ou plus | `node -v` | Oui | Minimum imposé par Next.js 16. |
| ffmpeg | `ffmpeg -version` | Oui | Décode l'audio à transcrire en PCM 16 kHz. |
| curl, tar, bzip2 | `command -v curl tar bzip2` | Oui | Téléchargement et extraction des modèles. |
| Espace disque | `df -h .` | Oui | Environ 5,5 Go en installation de base (`node_modules/`, `models/`, `voices/`, `bin/`), 7 Go avec Whisper medium, 14 à 16 Go avec le service Python (`python/.venv/` et cache `~/.cache/huggingface/`). Détail dans le README. |
| uv | `uv --version` | Non | Crée le virtualenv Python 3.12 du service Python. |
| GPU NVIDIA et CUDA | `nvidia-smi` | Non | Accélère Chatterbox et Whisper. Sans GPU, Chatterbox tourne lentement sur CPU. |

### Étapes

Installer les dépendances npm, le binaire Piper et espeak-ng dans `bin/`, les voix Piper dans `voices/` et les modèles sherpa-onnx dans `models/sherpa/`:

```bash
npm run setup
```

Les scripts sont idempotents: un fichier déjà présent est sauté, on peut relancer après une coupure réseau. Pour retélécharger seulement les modèles sherpa-onnx:

```bash
npm run setup:sherpa
```

Pour ajouter Whisper medium (1,8 Go):

```bash
npm run setup:sherpa -- --whisper-medium
```

Facultatif, installer le service Python (Chatterbox, Whisper sur GPU, secours Python) dans `python/.venv`. Le script fixe Python 3.12 car torch 2.6, imposé par Chatterbox, n'existe pas pour les versions plus récentes:

```bash
npm run setup:chatterbox
```

Facultatif, activer Groq Whisper: copier `.env.example` en `.env.local` à la racine, puis y renseigner `GROQ_API_KEY` ([clé gratuite sur la console Groq](https://console.groq.com/keys)). Ne jamais demander la clé dans la conversation ni l'écrire dans un fichier suivi par git: la personne la colle elle-même dans `.env.local`.

### Lancement et vérification

Lancer Next.js sur `http://localhost:3000` et, s'il est installé, le service Python sur `127.0.0.1:5002`:

```bash
npm run dev
```

Lancer Next.js seul:

```bash
npm run dev:next
```

Vérifier l'état de chaque moteur: `ok`, `degraded` (secours actif) ou `down`, avec la raison et une piste dans `hint`:

```bash
curl -s http://localhost:3000/api/health
```

Ouvrir ensuite `http://localhost:3000/tts`, générer un texte avec Piper, puis transcrire un échantillon de démo sur `/stt` avec Whisper.

Pour la production:

```bash
npm run build
```

```bash
npm start
```

### Dépannage

| Symptôme | Cause probable | Solution |
| -------- | -------------- | -------- |
| Piper, Whisper ou Sherpa `down`, message de modèle introuvable | Téléchargement incomplet de `models/sherpa/` | Relancer `npm run setup:sherpa`. |
| Voix Piper muette ou erreur de phonèmes | `bin/espeak-ng` absent ou non exécutable | Relancer `bash scripts/setup-piper.sh`, vérifier `ls -l bin/`. |
| Transcription en erreur de décodage | `ffmpeg` absent du `PATH` | Installer ffmpeg (`sudo apt install ffmpeg` sous Ubuntu), relancer `npm run dev`. |
| Chatterbox `down`, `PYTHON_SERVICE_DOWN` | Service Python non installé ou arrêté | `npm run setup:chatterbox`, puis `npm run dev` (et non `dev:next`). |
| Chatterbox très lent | Pas de CUDA, exécution sur CPU | Normal sans GPU; vérifier `nvidia-smi` et le message de fin de `setup:chatterbox`. |
| Edge TTS en erreur 403 ou réseau | Endpoint Microsoft non officiel modifié ou bloqué | Vérifier la connexion, puis une version plus récente de `msedge-tts`. |
| Groq `down`, clé absente | `.env.local` absent ou sans `GROQ_API_KEY` | Créer le fichier depuis `.env.example`, redémarrer le serveur. |
| Web Speech indisponible | Navigateur sans SpeechRecognition (Firefox) | Utiliser Chrome ou Edge. |

La page `/logs` et le fichier `output/logs/app.jsonl` donnent le détail de chaque erreur, filtrable par identifiant de requête.

## Moteurs

### Synthèse vocale (TTS)

- **Edge TTS** (`msedge-tts`, licence MIT): endpoint gratuit et non officiel des voix Microsoft Edge Neural, sans clé API. Voix retenues (`edge-tts-voices.ts`): Denise, Éloïse, Henri, et les voix multilingues Vivienne et Rémy. Depuis octobre 2026, la synthèse passe par `api.msedgeservices.com`; l'endpoint peut de nouveau changer sans prévenir.
- **Piper** (rhasspy/piper): voix ONNX (Siwis, UPMC, Tom, Gilles, Lessac). Exécuté dans Node par `sherpa-onnx-node` (modèles de `models/sherpa/`, phonèmes fournis par `bin/espeak-ng`), avec en secours le binaire natif lancé via `child_process` (voix de `voices/`).
- **Kokoro** (82M paramètres, Apache 2.0): exécuté en Node.js via ONNX Runtime (`kokoro-js`). Voix française `ff_siwis` et voix anglaises.
- **Chatterbox** (Resemble AI, MIT): clonage vocal à partir des échantillons de `python/tts/references/`, réglage de l'exagération émotionnelle, exécuté par le service Python (PyTorch, CUDA ou CPU).

### Reconnaissance vocale (STT)

- **Whisper**: sur CPU, exécuté dans Node par `sherpa-onnx-node` (modèles int8 tiny, base, small, medium en option), segments horodatés, Faster-Whisper du service Python en secours. Sur CUDA, Faster-Whisper directement, seul à fournir l'horodatage mot à mot.
- **Sherpa-ONNX**: NVIDIA Parakeet TDT 0.6B v3 (25 langues européennes, détection automatique) exécuté dans Node, avec Whisper `tiny` du service Python en secours.
- **Groq Whisper**: API cloud compatible OpenAI (`whisper-large-v3-turbo` ou `whisper-large-v3`), horodatage mot à mot sans score de confiance. Offre gratuite: 2 000 requêtes et 8 h d'audio par jour, 25 Mo par fichier.
- **Web Speech API**: transcription en direct dans le navigateur, sans serveur, uniquement depuis le micro.

## Architecture

Une seule app Next.js (App Router, React 19, Tailwind CSS v4) à la racine, plus un micro-service Python facultatif.

- `src/app/`: pages et routes.
  - `tts/`, `stt/`, `logs/`: les trois pages de l'interface (`/` redirige vers `/tts`).
  - `api/`: routes API (`health`, `voices`, `tts`, `tts/history`, `stt/transcribe`, `stt/history`, `logs`, `logs/stream` en SSE).
  - `audio/[...path]/route.ts`: sert les fichiers de `output/` avec support des requêtes Range.
- `src/lib/server/`: code serveur uniquement (`server-only`).
  - `core/`: socle commun (erreurs `AppError`, `api-handler`, logger, `request-context`, chemins, client et pont de logs du service Python, timeouts, client Groq). Pour les moteurs Node: `sherpa-runtime.ts` (chargement de `sherpa-onnx-node`, chemins des modèles, cache d'instances), `audio-decode.ts` (ffmpeg vers PCM 16 kHz), `espeak.ts` (phonémisation IPA), `runtime-fallback.ts` (bascule vers le secours et santé combinée).
  - `providers/tts/<provider>/` et `providers/stt/<provider>/`: un dossier par provider, fichiers nommés `<provider>-provider.ts` (plus catalogue de voix si besoin). Chaque domaine a son registre (`*-provider-registry.ts`), ses types et son service d'orchestration (`tts-synthesis-service.ts`, `stt-transcription-service.ts`).
  - `history/`: dépôts d'historique TTS et STT (écriture JSON atomique).
- `src/lib/shared/`: types et catalogue des providers partagés entre client et serveur.
- `src/lib/client/`: client API typé (`api-client.ts`), logger navigateur, utilitaires.
- `src/features/tts/`, `src/features/stt/`, `src/features/logs/`: composants propres à chaque page. Les réglages par provider sont dans `settings/<provider>-settings-panel.tsx`.
- `src/components/`: `layout/` (en-tête, thème, état de santé), `shared/` (panneau Activité, matrice décisionnelle, historique filtrable, sélecteur et fiches des providers, ligne de log), `ui/` (briques génériques).
- `src/hooks/`: hooks transverses (spectre audio, flux de logs, historique, état persistant).
- `python/`: micro-service FastAPI (`app.py`, écoute sur `127.0.0.1:5002`) exposant `/health`, `/references`, `/tts`, `/stt/transcribe` et `/logs`.
  - `tts/chatterbox.py` et `tts/references/` (échantillons de synthèse pour le clonage vocal).
  - `stt/whisper.py`: transcription Faster-Whisper.
  - `log_buffer.py`: tampon de logs interrogé par Next.
- `scripts/setup-piper.sh`: binaire Piper dans `bin/` et voix dans `voices/`.
- `scripts/setup-sherpa.sh`: voix Piper, Parakeet v3, Whisper int8 et VAD Silero dans `models/sherpa/`.
- `scripts/setup-chatterbox.sh`: virtualenv `python/.venv` en Python 3.12 avec uv.
- `scripts/ai-service.sh`: lance le service Python s'il est installé, sinon s'arrête sans erreur (appelé par `npm run dev`).

`bin/`, `voices/`, `models/`, `output/` (audios générés, historiques, logs) et `.env.local` ne sont pas commités (voir `.gitignore`).

## Erreurs et logs

- Toute route passe par `withApiHandler`, qui renvoie une enveloppe `{ error: { code, message, hint, provider, requestId } }` avec le statut HTTP adapté. Une erreur inconnue devient `INTERNAL`, sans stack côté client.
- Le client génère un identifiant `req_xxx` envoyé dans l'en-tête `X-Request-Id`, ce qui permet au panneau Activité de suivre une requête en direct.
- Le logger garde un tampon circulaire en mémoire, écrit dans `output/logs/app.jsonl` et diffuse en SSE sur `/api/logs/stream`. Les logs Python sont récupérés en interrogeant `/logs` du service tant qu'un client SSE est connecté. Les erreurs navigateur (micro, Web Speech, rendu) arrivent par `POST /api/logs`.

## Décisions techniques

- Moteurs locaux exécutés côté serveur (Node, ou binaire natif en secours), pas en WASM navigateur, pour que les mesures restent représentatives d'un déploiement serveur.
- Moteurs locaux en Node d'abord (`sherpa-onnx-node`), Python ou binaire en secours: la bascule n'a lieu que sur une panne du moteur, jamais sur une annulation, un délai ou une entrée invalide. Le résultat et l'historique indiquent le moteur réellement utilisé (`runtime`, `fallback`).
- Depuis sherpa-onnx 2.0, les voix Piper attendent des phonèmes déjà calculés: espeak-ng (livré avec l'archive Piper) les fournit. `piper-phonemize-node` est écarté car sous GPL.
- Binaire Piper pris sur le dépôt archivé sous MIT plutôt que sur le fork actif GPL-3.0, pour garder le projet redistribuable sous MIT.
- `onnxruntime-node`, `kokoro-js`, `sherpa-onnx-node`, `msedge-tts` et `ws` sont déclarés dans `serverExternalPackages` (`next.config.ts`) pour ne jamais être bundlés.
- Clés d'API lues uniquement côté serveur depuis `.env.local`, jamais exposées au navigateur.

## Conventions

- Interface, messages d'erreur, commentaires et documentation en français.
- Un nouveau provider suit le modèle des dossiers existants: fichier `<provider>-provider.ts`, inscription dans le registre du domaine, fiche dans `src/lib/shared/provider-catalog.ts`, panneau de réglages dans `src/features/<domaine>/settings/`.
- Toute erreur prévisible lève une `AppError` avec un code, un message et une piste (`hint`) utilisable par la personne.
- Vérifier les types avant de proposer un changement:

```bash
npm run typecheck
```

## Données sensibles

Le dépôt est public: aucun fichier ni aucune donnée sensible ne doit être indexé, même temporairement, car un commit poussé reste dans l'historique.

- Ne jamais indexer: `.env.local` ou tout `.env` autre que `.env.example`, clés et certificats, `output/` (audios, historiques et logs qui peuvent contenir la voix ou les propos de la personne), `models/`, `voices/`, `bin/`, `.doc/`, `CLAUDE.local.md`.
- Ne jamais écrire dans un fichier suivi une clé d'API, un mot de passe, un chemin personnel absolu (`/home/<utilisateur>`), une adresse e-mail ou toute autre donnée personnelle.
- Indexer fichier par fichier plutôt qu'avec `git add -A` ou `git add .`, puis relire la liste avant chaque commit:

```bash
git diff --staged --name-only
```

- Le hook `.githooks/pre-commit`, activé par `npm install` (script `prepare`), lance `scripts/check-sensitive.sh` et bloque le commit si un fichier ou un secret reconnu est indexé. On peut le lancer à la main:

```bash
npm run check:sensitive
```

- Des motifs propres à votre machine (nom d'utilisateur, projets privés, domaines) s'ajoutent dans `.git/info/sensitive-patterns`, une expression régulière par ligne. Ce fichier n'est jamais versionné.
- `git commit --no-verify` ne sert qu'à passer un faux positif vérifié, jamais à forcer un fichier signalé.
- Si un secret a été poussé malgré tout, le révoquer immédiatement auprès du service concerné: le retirer de l'historique ne suffit pas.

## Pistes envisagées

- XTTS-v2, via un service Python séparé (licence Coqui CPML non commerciale à vérifier avant tout usage au-delà du test).
- Chatterbox en Node quand transformers.js gérera le modèle multilingue.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
