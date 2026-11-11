# Etcetera Audio Lab

Banc d'essai de moteurs de synthèse vocale (TTS) et de reconnaissance vocale (STT), en vue d'une intégration ultérieure dans l'app NextJS (SSR) de Nicolas et d'un déploiement sur le VPS OVH (alternative-rvb.cloud), pas avant feu vert explicite.

C'est le laboratoire voix de NowWeAct (`/home/nicolas/projets/_github/NowWeAct`): toute nouvelle fonctionnalité TTS ou STT (nouveau moteur, nouvelle voix, changement de lib, diagnostic de panne) se teste et se compare ici avant d'être portée dans NowWeAct. NowWeAct le référence dans son propre `AGENTS.md`.

Le projet s'appelait TTS-test jusqu'à la migration vers Next.js (backlog id 23). Son nom complet est Etcetera Audio Lab, à ne pas abréger en Etcetera, qui désigne un autre projet plus ancien (dépôt `alternative-rvb/etcetera`). Le dépôt GitHub (`alternative-rvb/etcetera-audio-lab`) et le dossier local s'appellent désormais `etcetera-audio-lab`.

## Portée actuelle

### Synthèse vocale (TTS)

- **Edge TTS** (`msedge-tts`, licence MIT): endpoint gratuit non officiel des voix Microsoft Edge Neural, aucune clé API. C'est le moteur utilisé en production dans NowWeAct (`app/api/tts/speak/route.ts`). Les deux projets sont passés de `edge-tts-universal` 1.4.0 à `msedge-tts` 2.1.1 le 2026-11-11: depuis octobre 2026, Microsoft a déplacé la synthèse vers `api.msedgeservices.com` et l'ancienne lib restait bloquée sur l'ancien hôte (backlog id 24 ici, #257 dans NowWeAct).
- **Piper** (rhasspy/piper): moteur local, voix ONNX (Siwis, UPMC, etc.). Exécuté dans Node par `sherpa-onnx-node` (modèles de `models/sherpa/`, phonèmes fournis par `bin/espeak-ng`), avec en secours le binaire natif lancé via `child_process` (voix de `voices/`).
- **Kokoro** (82M paramètres, licence Apache 2.0): qualité supérieure à Piper, exécuté en Node.js via ONNX Runtime (`kokoro-js`). Voix française `ff_siwis` et voix anglaises expressives.
- **Chatterbox** (Resemble AI, licence MIT): clonage vocal zéro-shot à partir d'échantillons de référence, avec réglage de l'exagération émotionnelle, exécuté par le micro-service Python (PyTorch, CUDA sur RTX 3070 ou CPU).

### Reconnaissance vocale (STT)

- **Whisper**: sur CPU, exécuté dans Node par `sherpa-onnx-node` (modèles int8 tiny, base, small, medium en option), segments horodatés, Faster-Whisper du service Python en secours. Sur CUDA, Faster-Whisper du service Python directement, seul à fournir l'horodatage mot à mot.
- **Sherpa-ONNX**: NVIDIA Parakeet TDT 0.6B v3 (25 langues européennes, détection automatique) exécuté dans Node par `sherpa-onnx-node`, avec Whisper `tiny` du service Python en secours.
- **Groq Whisper**: API cloud compatible OpenAI (`whisper-large-v3-turbo` ou `whisper-large-v3`), horodatage mot à mot sans score de confiance. Clé `GROQ_API_KEY` dans `.env.local` (ignoré par git). Offre gratuite: 2 000 requêtes et 8 h d'audio par jour, 25 Mo par fichier.
- **Web Speech API**: transcription en direct dans le navigateur, sans serveur, uniquement depuis le micro.
- **Analyse IA des transcriptions** (Groq, modèle `openai/gpt-oss-20b`, surchargeable par `GROQ_ANALYSIS_MODEL`): lancée automatiquement après chaque transcription (route `POST /api/stt/history/[id]/analyze`), elle note le texte de 1 à 3 (ponctuation, cohérence, fluidité, mots suspects, résumé) dans `aiScore` et `analysis`, champs séparés de la note manuelle `score`. Sans texte de référence, elle juge la lisibilité, pas l'exactitude. Le texte transcrit part chez Groq. La matrice du Comparatif prend la note manuelle si elle existe, sinon la note IA (point en anneau).

## Architecture

Une seule app Next.js (App Router, React 19, Tailwind CSS v4) à la racine, plus un micro-service Python pour Chatterbox et Faster-Whisper.

- `src/app/`: pages et routes.
  - `tts/`, `stt/`, `logs/`: les trois pages de l'interface (`/` redirige vers `/tts`).
  - `api/`: routes API (`health`, `voices`, `tts`, `tts/history`, `stt/transcribe`, `stt/history`, `logs`, `logs/stream` en SSE).
  - `audio/[...path]/route.ts`: sert les fichiers de `output/` avec support des requêtes Range.
- `src/lib/server/`: code serveur uniquement (`server-only`).
  - `core/`: socle commun (erreurs `AppError`, `api-handler`, logger, `request-context`, chemins, client et pont de logs du service Python, timeouts). Pour les moteurs Node: `sherpa-runtime.ts` (chargement de `sherpa-onnx-node`, chemins des modèles, cache d'instances), `audio-decode.ts` (ffmpeg vers PCM 16 kHz), `espeak.ts` (phonémisation IPA), `runtime-fallback.ts` (bascule vers le secours et santé combinée).
  - `providers/tts/<provider>/` et `providers/stt/<provider>/`: un dossier par provider, fichiers nommés `<provider>-provider.ts` (plus catalogue de voix si besoin). Chaque domaine a son registre (`*-provider-registry.ts`), ses types et son service d'orchestration (`tts-synthesis-service.ts`, `stt-transcription-service.ts`).
  - `history/`: dépôts d'historique TTS et STT (écriture JSON atomique).
- `src/lib/shared/`: types et catalogue des providers partagés entre client et serveur.
- `src/lib/client/`: client API typé (`api-client.ts`), logger navigateur, utilitaires.
- `src/features/tts/`, `src/features/stt/`, `src/features/logs/`: composants propres à chaque page. Les réglages par provider sont dans `settings/<provider>-settings-panel.tsx`.
- `src/components/`: `layout/` (en-tête, thème, état de santé), `shared/` (panneau Activité, matrice décisionnelle, historique filtrable, sélecteur et fiches des providers, ligne de log), `ui/` (briques génériques).
- `src/hooks/`: hooks transverses (spectre audio, flux de logs, historique, état persistant).
- `python/`: micro-service FastAPI (`app.py`) exposant `/health`, `/references`, `/tts`, `/stt/transcribe` et `/logs`.
  - `tts/chatterbox.py` et `tts/references/` (échantillons pour le clonage vocal).
  - `stt/whisper.py`: transcription Faster-Whisper.
  - `log_buffer.py`: tampon de logs interrogé par Next.
- `scripts/setup-piper.sh`: télécharge le binaire Piper dans `bin/` et les voix dans `voices/`.
- `scripts/setup-sherpa.sh`: télécharge dans `models/sherpa/` les voix Piper, Parakeet v3, Whisper int8 et la VAD Silero.
- `scripts/setup-chatterbox.sh`: crée le virtualenv `python/.venv` en Python 3.12 avec uv et installe les dépendances.
- `scripts/ai-service.sh`: lance le service Python s'il est installé, sinon s'arrête sans erreur (appelé par `npm run dev`).

`bin/`, `voices/`, `models/` et `output/` (audios générés, historiques, logs) ne sont pas commités (voir `.gitignore`).

## Erreurs et logs

- Toute route passe par `withApiHandler`, qui renvoie une enveloppe `{ error: { code, message, hint, provider, requestId } }` avec le statut HTTP adapté. Une erreur inconnue devient `INTERNAL`, sans stack côté client.
- Le client génère un identifiant `req_xxx` envoyé dans l'en-tête `X-Request-Id`, ce qui permet au panneau Activité de suivre une requête en direct.
- Le logger garde un tampon circulaire en mémoire, écrit dans `output/logs/app.jsonl` et diffuse en SSE sur `/api/logs/stream`. Les logs Python sont récupérés en interrogeant `/logs` du service tant qu'un client SSE est connecté. Les erreurs navigateur (micro, Web Speech, rendu) arrivent par `POST /api/logs`.

## Décisions notables

- Moteurs locaux exécutés côté serveur (Node, ou binaire natif en secours), pas en WASM navigateur, pour rester représentatif d'un usage serveur portable sur le VPS.
- Moteurs locaux en Node d'abord (`sherpa-onnx-node`), Python ou binaire en secours: la bascule n'a lieu que sur une panne du moteur, jamais sur une annulation, un délai ou une entrée invalide. Le résultat et l'historique indiquent le moteur réellement utilisé (`runtime`, `fallback`).
- Depuis sherpa-onnx 2.0, les voix Piper attendent des phonèmes déjà calculés: espeak-ng (livré avec l'archive Piper) les fournit. `piper-phonemize-node` est écarté car sous GPL.
- Binaire Piper pris sur le repo archivé MIT plutôt que sur le fork actif GPL-3.0, pour éviter toute contrainte de redistribution si le projet est distribué publiquement.
- Edge TTS aligné sur NowWeAct: même lib (`msedge-tts`), mêmes voix Neural (Denise et Henri en français, Aria et Guy en anglais). L'endpoint reste non documenté par Microsoft et peut de nouveau changer sans prévenir.
- `onnxruntime-node`, `kokoro-js`, `sherpa-onnx-node`, `msedge-tts` et `ws` sont déclarés dans `serverExternalPackages` (`next.config.ts`) pour ne jamais être bundlés.

## Démarrage

Installer les dépendances, le binaire Piper, les voix et les modèles sherpa-onnx (`ffmpeg` requis sur la machine):

```bash
npm run setup
```

Installer l'environnement Python pour Chatterbox, Whisper sur GPU et le secours Python (optionnel, nécessite uv):

```bash
npm run setup:chatterbox
```

Lancer l'app sur `http://localhost:3000` et le micro-service Python (port 5002) s'il est installé:

```bash
npm run dev
```

Lancer l'app seule:

```bash
npm run dev:next
```

## Suite envisagée

- XTTS-v2: via un mini-service Python séparé, un Space HuggingFace stable, ou un budget HF validé. Licence Coqui CPML non commerciale par défaut, à vérifier avant tout usage au-delà du test.
- Chatterbox en Node quand transformers.js gérera le modèle multilingue (backlog id 27).
- Déploiement sur le VPS OVH (skill `vps-deploy`), avec `ffmpeg` installé sur le serveur.
- Intégration dans l'app existante une fois la voix validée.

## Suivi du backlog

Backlog CSV: `.doc/backlog.csv` (actif) et `.doc/archives/backlog-archive-AAAA-MM-JJ.csv` (terminées). Workflow commun décrit dans le skill `backlog-csv-workflow`. Le commit inclut le mouvement de backlog, au format `[id] Résumé court`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
