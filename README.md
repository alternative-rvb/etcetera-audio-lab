# Etcetera

Audio Lab: banc d'essai de moteurs de synthèse vocale (TTS) et de reconnaissance vocale (STT) pour le français, en vue d'une intégration dans une app NextJS et d'un déploiement sur VPS. Voir [AGENTS.md](AGENTS.md) pour le contexte et les décisions d'architecture.

L'interface compte trois pages: Synthèse (`/tts`), Transcription (`/stt`) et Logs (`/logs`), avec trois thèmes (clair, sombre, rétro Y2K).

## Solutions testées

### Text-to-Speech (TTS)

| Moteur | Type | Licence | Version utilisée | Dernière version | Particularités |
| ------ | ---- | ------- | ---------------- | ---------------- | -------------- |
| Edge TTS (`msedge-tts`) | API distante, non officielle | MIT (lib) | 2.1.1 | ![npm](https://img.shields.io/npm/v/msedge-tts?label=) | Voix Microsoft Edge Neural, aucune clé API |
| Piper | Local, binaire natif | MIT (repo archivé) | 2023.11.14-2 | ![GitHub release](https://img.shields.io/github/v/release/rhasspy/piper?label=) | Voix ONNX (Siwis, UPMC, etc.), CPU |
| Kokoro (82M, `kokoro-js`) | Local, Node.js + ONNX Runtime | Apache 2.0 | kokoro-js 1.2.1, onnxruntime-node 1.30.0 | ![npm](https://img.shields.io/npm/v/kokoro-js?label=) | Qualité supérieure à Piper, voix française `ff_siwis` |
| Chatterbox (Resemble AI) | Local, micro-service Python | MIT | chatterbox-tts 0.1.7, torch 2.6.0 | ![PyPI](https://img.shields.io/pypi/v/chatterbox-tts?label=) | Clonage vocal zéro-shot, exagération émotionnelle, GPU CUDA recommandé |

### Speech-to-Text (STT)

| Moteur | Type | Licence | Version utilisée | Dernière version | Particularités |
| ------ | ---- | ------- | ---------------- | ---------------- | -------------- |
| Faster-Whisper | Local, micro-service Python | MIT | 1.2.1 (modèle `base` par défaut) | ![PyPI](https://img.shields.io/pypi/v/faster-whisper?label=) | CUDA ou CPU, horodatage des mots |
| Sherpa-ONNX | Local, CPU | Apache 2.0 | Provisoire | ![PyPI](https://img.shields.io/pypi/v/sherpa-onnx?label=) | Substitut Faster-Whisper `tiny` ou `base` sur CPU en attendant le vrai moteur |
| Web Speech API | Navigateur | Sans objet | Selon le navigateur | Sans objet | Transcription en direct depuis le micro, sans serveur |

### Piste suivante

XTTS-v2 (licence Coqui CPML non commerciale à vérifier avant tout usage au-delà du test).

## Installation

Installer les dépendances, le binaire Piper (dans `bin/`) et deux voix, française et anglaise (dans `voices/`):

```bash
npm run setup
```

Pour Chatterbox et Faster-Whisper (optionnel), créer l'environnement Python PyTorch dans `python/.venv`:

```bash
npm run setup:chatterbox
```

## Lancement en développement

Lancer l'app Next.js sur `http://localhost:3000`:

```bash
npm run dev
```

Lancer l'app et le micro-service Python (port 5002) pour Chatterbox et Faster-Whisper:

```bash
npm run dev:all
```

Sans le service Python, Chatterbox, Faster-Whisper et Sherpa apparaissent comme indisponibles dans l'interface, avec la commande à lancer.

## Suivre ce qui se passe

La page Logs affiche en temps réel les événements de chaque provider (Node, Python et navigateur), filtrables par source, niveau, texte ou identifiant de requête, avec export JSON. Sur les pages Synthèse et Transcription, le panneau Activité suit la dernière requête en direct. Les logs sont aussi écrits dans `output/logs/app.jsonl`.

## Ajouter une voix Piper

1. Trouver la voix voulue sur [huggingface.co/rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices).
2. Télécharger le `.onnx` et le `.onnx.json` correspondants dans `voices/`.
3. Recharger la page: la voix apparaît automatiquement dans le sélecteur.

## Build production

Construire l'app:

```bash
npm run build
```

Démarrer le serveur de production:

```bash
npm start
```
