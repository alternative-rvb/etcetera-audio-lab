# TTS-test

Banc d'essai de moteurs de synthèse vocale (TTS) et de reconnaissance vocale (STT) pour le français, en vue d'une intégration dans une app NextJS et d'un déploiement sur VPS. Voir [AGENTS.md](AGENTS.md) pour le contexte et les décisions d'architecture.

## Solutions testées

### Text-to-Speech (TTS)

| Moteur | Type | Licence | Version utilisée | Dernière version | Particularités |
| ------ | ---- | ------- | ---------------- | ---------------- | -------------- |
| Edge TTS (`edge-tts-universal`) | API distante, non officielle | AGPL-3.0 (lib) | 1.4.0 | ![npm](https://img.shields.io/npm/v/edge-tts-universal?label=) | Voix Microsoft Edge Neural, aucune clé API |
| Piper | Local, binaire natif | MIT (repo archivé) | 2023.11.14-2 | ![GitHub release](https://img.shields.io/github/v/release/rhasspy/piper?label=) | Voix ONNX (Siwis, UPMC, etc.), CPU |
| Kokoro (82M, `kokoro-js`) | Local, Node.js + ONNX Runtime | Apache 2.0 | kokoro-js 1.2.1, onnxruntime-node 1.30.0 | ![npm](https://img.shields.io/npm/v/kokoro-js?label=) | Qualité supérieure à Piper, voix française `ff_siwis` |
| Chatterbox (Resemble AI) | Local, micro-service Python | MIT | chatterbox-tts 0.1.7, torch 2.6.0 | ![PyPI](https://img.shields.io/pypi/v/chatterbox-tts?label=) | Clonage vocal zéro-shot, exagération émotionnelle, GPU CUDA recommandé |

### Speech-to-Text (STT)

| Moteur | Type | Licence | Version utilisée | Dernière version | Particularités |
| ------ | ---- | ------- | ---------------- | ---------------- | -------------- |
| Faster-Whisper | Local, micro-service Python | MIT | 1.2.1 (modèle `base` par défaut) | ![PyPI](https://img.shields.io/pypi/v/faster-whisper?label=) | CUDA ou CPU, horodatage des mots |
| Sherpa-ONNX | Local, CPU | Apache 2.0 | 1.13.8 (installée) | ![PyPI](https://img.shields.io/pypi/v/sherpa-onnx?label=) | Option modèle `tiny` sur CPU |
| Web Speech API | Navigateur | Sans objet | Selon le navigateur | Sans objet | Transcription en direct, sans serveur |

### Piste suivante

XTTS-v2 (licence Coqui CPML non commerciale à vérifier avant tout usage au-delà du test).

## Installation

```bash
npm install
npm run setup
```

`npm run setup` télécharge le binaire Piper dans `server/bin/` et deux voix (français, anglais) dans `server/voices/`, puis installe les dépendances de `server/` et `web/`.

Pour Chatterbox et Faster-Whisper (optionnel, environnement Python PyTorch) :

```bash
npm run setup:chatterbox
```

## Lancement en développement

```bash
npm run dev
```

Lance le serveur (`http://localhost:3001`) et le frontend (`http://localhost:5173`) en parallèle depuis la racine. Le frontend proxifie les appels `/api` vers le serveur.

```bash
npm run dev:all
```

Ajoute le micro-service Python (port 5002) pour Chatterbox et Faster-Whisper.

## Ajouter une voix Piper

1. Trouver la voix voulue sur [huggingface.co/rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices).
2. Télécharger le `.onnx` et le `.onnx.json` correspondants dans `server/voices/`.
3. Redémarrer le serveur : la voix apparaît automatiquement dans le sélecteur.

## Build production

```bash
cd web && npm run build
cd ../server && npm run build && npm start
```

Le serveur sert alors le frontend buildé (`web/dist`) en plus de l'API.
