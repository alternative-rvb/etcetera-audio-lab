# TTS-test

Projet de test de moteurs de synthèse vocale (text-to-speech), en vue d'une intégration ultérieure dans l'app NextJS (SSR) de Nicolas et d'un déploiement sur le VPS OVH (alternative-rvb.cloud) — pas avant feu vert explicite.

## Portée actuelle

Quatre moteurs implémentés et sélectionnables dans l'interface :

- **Edge TTS** (`edge-tts-universal`, licence AGPL-3.0) : endpoint gratuit non-officiel des voix Microsoft Edge Neural, aucune clé API. C'est le moteur déjà utilisé en production dans l'app NextJS de Nicolas (NowWeAct, `app/api/tts/speak/route.ts`).
- **Piper** (rhasspy/piper) : moteur local, binaire natif via `child_process`, voix ONNX (Siwis, UPMC, etc.).
- **Kokoro** (82M paramètres, licence Apache 2.0) : qualité studio supérieure à Piper, exécuté localement en Node.js via ONNX Runtime (`kokoro-js`). Supporte la voix française Siwis (`ff_siwis`) et des voix anglaises expressives.
- **Chatterbox** (Resemble AI, licence MIT) : clonage vocal zéro-shot sous licence commerciale permissive libre, exécuté via un micro-service Python (FastAPI + PyTorch CUDA sur GPU RTX 3070), permettant d'ajuster l'exagération émotionnelle et de synthétiser à partir d'échantillons audios de référence.

## Architecture

- `server/` : API Node/TypeScript (Express).
  - `src/piper.ts` : exécute le binaire natif Piper via `child_process`, enveloppe le PCM brut (`--output_raw`) en WAV.
  - `src/voices.ts` : liste les voix Piper disponibles (scan de `server/voices/*.onnx.json`).
  - `src/edgeTts.ts` : appelle `edge-tts-universal` (liste de voix fixe `EDGE_VOICES`), renvoie du MP3.
  - `src/kokoro.ts` : charge Kokoro-82M ONNX via `kokoro-js`, génère un WAV 24kHz.
  - `src/chatterbox.ts` : client HTTP appelant le micro-service Python Chatterbox sur `http://127.0.0.1:5002`.
  - `src/history.ts` : gestion de l'historique et sauvegarde des fichiers audio dans `server/output/`.
  - `src/index.ts` : routes `GET /api/voices?engine=...` et `POST /api/tts` dispatchant vers les 4 moteurs.
- `server/python/` :
  - `chatterbox_service.py` : micro-service FastAPI exposant `/health`, `/references`, et `/tts` (génération PyTorch CUDA 24kHz).
  - `references/` : échantillons audios de référence pour le clonage vocal.
  - `requirements.txt` : dépendances Python (`torch`, `torchaudio`, `chatterbox-tts`, `fastapi`, `uvicorn`).
- `web/` : frontend TypeScript + Vite. Sélecteur à 4 moteurs avec code couleur persistant (Edge: violet, Piper: bleu, Kokoro: vert émeraude, Chatterbox: rose framboise), réglages dédiés, badges, onglets d'explication et filtres d'historique.
- `scripts/setup-piper.sh` : télécharge le binaire Piper et les modèles de voix.
- `scripts/setup-chatterbox.sh` : initialise le virtualenv Python et installe les dépendances Chatterbox.

Le binaire (`server/bin/`) et les voix (`server/voices/`) sont téléchargés par le script, pas commités (voir `.gitignore`).

## Décisions notables

- Piper est choisi en binaire natif + `child_process`, pas en WASM navigateur, pour rester représentatif d'un usage serveur portable sur le VPS.
- Binaire Piper pris sur le repo archivé MIT plutôt que le fork actif GPL-3.0, pour éviter toute contrainte de redistribution si le projet est distribué publiquement.
- CPU uniquement, pas de GPU (Piper est déjà rapide en CPU).
- Edge TTS repris à l'identique de l'implémentation existante dans NowWeAct plutôt que réinventé : même lib (`edge-tts-universal`), mêmes voix Neural (Denise/Henri en français, Aria/Guy en anglais). Attention : licence AGPL-3.0 de la lib (plus contraignante que la GPL de Piper si le service est exposé en réseau/SaaS — à garder en tête si ce module part vers un vrai déploiement).

## Démarrage

Tout se pilote depuis la racine (`package.json` racine + `concurrently`) :

```bash
npm install
npm run setup            # télécharge le binaire piper + voix fr/en, installe server/ et web/
npm run setup:chatterbox # (optionnel) installe l'environnement Python PyTorch pour Chatterbox
npm run dev              # lance API (3001) et frontend (5173) en parallèle
npm run dev:all          # lance tout en 1 commande : API (3001), frontend (5173) et Chatterbox (5002)
```

## Suite envisagée

- XTTS-v2 : via un mini-service Python séparé, un Space HuggingFace stable, ou un budget HF validé. Licence Coqui CPML non-commerciale par défaut à vérifier avant tout usage au-delà du test.
- Déploiement sur le VPS OVH (skill `vps-deploy`).
- Intégration dans l'app existante une fois la voix validée.

## Backlog

Pour suivre ce qui reste à faire.

@.doc/BACKLOG.md