# Etcetera Audio Lab

Banc d'essai de moteurs de synthèse vocale (TTS) et de reconnaissance vocale (STT) pour le français, en vue d'une intégration dans une app NextJS et d'un déploiement sur VPS. Voir [AGENTS.md](AGENTS.md) pour le contexte et les décisions d'architecture.

L'interface compte trois pages: Synthèse (`/tts`), Transcription (`/stt`) et Logs (`/logs`), avec trois thèmes (clair, sombre, rétro Y2K).

## Solutions testées

### Text-to-Speech (TTS)

| Moteur | Type | Licence | Version utilisée | Dernière version | Particularités |
| ------ | ---- | ------- | ---------------- | ---------------- | -------------- |
| Edge TTS (`msedge-tts`) | API distante, non officielle | MIT (lib) | 2.1.1 | ![npm](https://img.shields.io/npm/v/msedge-tts?label=) | Voix Microsoft Edge Neural, aucune clé API |
| Piper | Local, Node.js (`sherpa-onnx-node`), binaire natif en secours | MIT (voix, binaire archivé), Apache 2.0 (sherpa-onnx) | sherpa-onnx-node 2.0.1, binaire 2023.11.14-2 | ![npm](https://img.shields.io/npm/v/sherpa-onnx-node?label=) | Voix ONNX (Siwis, UPMC, etc.), CPU |
| Kokoro (82M, `kokoro-js`) | Local, Node.js + ONNX Runtime | Apache 2.0 | kokoro-js 1.2.1, onnxruntime-node 1.31.1 | ![npm](https://img.shields.io/npm/v/kokoro-js?label=) | Qualité supérieure à Piper, voix française `ff_siwis` |
| Chatterbox (Resemble AI) | Local, micro-service Python | MIT | chatterbox-tts 0.1.7, torch 2.6.0 | ![PyPI](https://img.shields.io/pypi/v/chatterbox-tts?label=) | Clonage vocal zéro-shot, exagération émotionnelle, GPU CUDA recommandé |

### Speech-to-Text (STT)

| Moteur | Type | Licence | Version utilisée | Dernière version | Particularités |
| ------ | ---- | ------- | ---------------- | ---------------- | -------------- |
| Whisper | CPU: Node.js (`sherpa-onnx-node`), Python en secours; GPU: micro-service Python (Faster-Whisper) | MIT | sherpa-onnx-node 2.0.1, faster-whisper 1.2.1 (modèle `base` par défaut) | ![PyPI](https://img.shields.io/pypi/v/faster-whisper?label=) | Segments horodatés sur CPU, horodatage des mots sur GPU |
| Sherpa-ONNX (Parakeet TDT 0.6B v3) | Local, Node.js, CPU | Apache 2.0 (sherpa-onnx), CC-BY 4.0 (modèle) | sherpa-onnx-node 2.0.1 | ![npm](https://img.shields.io/npm/v/sherpa-onnx-node?label=) | 25 langues européennes détectées automatiquement, Whisper `tiny` Python en secours |
| Web Speech API | Navigateur | Sans objet | Selon le navigateur | Sans objet | Transcription en direct depuis le micro, sans serveur |

### Piste suivante

XTTS-v2 (licence Coqui CPML non commerciale à vérifier avant tout usage au-delà du test).

## Installation

Installer les dépendances, le binaire Piper et espeak-ng (dans `bin/`), deux voix Piper (dans `voices/`) et les modèles sherpa-onnx exécutés dans l'app (environ 3 Go dans `models/sherpa/`). `ffmpeg` doit être installé sur la machine pour décoder l'audio à transcrire:

```bash
npm run setup
```

Pour retélécharger seulement les modèles sherpa-onnx (ajouter `-- --whisper-medium` pour Whisper medium, 1,8 Go de plus):

```bash
npm run setup:sherpa
```

Pour Chatterbox, Whisper sur GPU et le secours Python (optionnel), créer l'environnement Python 3.12 dans `python/.venv` (nécessite [uv](https://docs.astral.sh/uv/)):

```bash
npm run setup:chatterbox
```

## Lancement en développement

Lancer l'app Next.js sur `http://localhost:3000` et, s'il est installé, le micro-service Python sur le port 5002:

```bash
npm run dev
```

Lancer seulement l'app Next.js:

```bash
npm run dev:next
```

Le service Python est facultatif: sans lui, seuls Chatterbox et Whisper sur GPU sont indisponibles, et le secours Python des moteurs Node ne peut plus prendre le relais. Piper, Kokoro, Edge TTS, Whisper sur CPU et Sherpa tournent dans l'app.

## Suivre ce qui se passe

La page Logs affiche en temps réel les événements de chaque provider (Node, Python et navigateur), filtrables par source, niveau, texte ou identifiant de requête, avec export JSON. Sur les pages Synthèse et Transcription, le panneau Activité suit la dernière requête en direct. Les logs sont aussi écrits dans `output/logs/app.jsonl`.

## Ajouter une voix Piper

1. Trouver la voix voulue sur [huggingface.co/rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices).
2. Télécharger le `.onnx` et le `.onnx.json` correspondants dans `voices/` (utilisés par le binaire de secours).
3. Pour l'exécution dans l'app, télécharger aussi l'archive `vits-piper-<voix>` des [modèles TTS sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models) et l'extraire dans `models/sherpa/`.
4. Recharger la page: la voix apparaît automatiquement dans le sélecteur.

## Build production

Construire l'app:

```bash
npm run build
```

Démarrer le serveur de production:

```bash
npm start
```
