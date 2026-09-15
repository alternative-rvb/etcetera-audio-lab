# TTS-test

Projet de test de moteurs de synthèse vocale (text-to-speech), en vue d'une intégration ultérieure dans l'app NextJS (SSR) de Nicolas et d'un déploiement sur le VPS OVH (alternative-rvb.cloud) — pas avant feu vert explicite.

## Portée actuelle

Deux moteurs implémentés et sélectionnables dans l'interface :

- **Piper** (rhasspy/piper) : moteur local, binaire natif via `child_process`.
- **Edge TTS** (`edge-tts-universal`, licence AGPL-3.0) : endpoint gratuit non-officiel des voix Microsoft Edge Neural, aucune clé API. C'est le moteur déjà utilisé en production dans l'app NextJS de Nicolas (NowWeAct, `app/api/tts/speak/route.ts`) — implémenté ici à l'identique (même lib, même approche `EdgeTTS(text, voice, { rate })`) pour comparer sa qualité face aux autres pistes.

XTTS-v2 (Coqui) a été évalué et repoussé : aucune implémentation Node n'existe (modèle PyTorch), le quota gratuit de l'API HuggingFace Inference est quasi inexploitable (0,10 $/mois), et les Spaces publics gratuits testés étaient hors service au moment de l'évaluation. À réévaluer plus tard.

Deux alternatives identifiées en 2026, toutes deux gratuites et sans quota en auto-hébergement (contrairement à l'API HuggingFace Inference utilisée pour évaluer XTTS-v2) :

- **Kokoro** (82M paramètres, licence Apache 2.0) : qualité nettement supérieure à Piper, tourne en CPU pur (environ 4 Go RAM) via ONNX, et dispose d'une implémentation JS native (`kokoro-js`, Xenova/transformers.js) qui s'intègre directement dans le stack Node/TypeScript existant sans binaire externe ni service Python. Limite : pas de clonage de voix, 54 voix fixes sur 8 langues. Candidat sérieux pour succéder à Piper ou s'ajouter à côté.
- **Chatterbox** (Resemble AI, licence MIT) : alternative directe à XTTS-v2 pour le clonage de voix, sans la contrainte de licence non-commerciale CPML (Coqui l'entreprise a fermé en janvier 2024, la licence XTTS-v2 reste bloquée en non-commercial). Reste un modèle PyTorch nécessitant un mini-service Python séparé (ex. `Chatterbox-TTS-Server`, compatible API OpenAI, CPU ou GPU).

## Architecture

- `server/` : API Node/TypeScript (Express).
  - `src/piper.ts` : exécute le binaire natif Piper via `child_process`, enveloppe le PCM brut (`--output_raw`) en WAV.
  - `src/voices.ts` : liste les voix Piper disponibles (scan de `server/voices/*.onnx.json`).
  - `src/edgeTts.ts` : appelle `edge-tts-universal` (liste de voix fixe `EDGE_VOICES`), renvoie du MP3.
  - `src/index.ts` : routes `GET /api/voices?engine=piper|edge` et `POST /api/tts` (`{ text, voiceId, engine, ... }`), dispatch vers le bon moteur.
- `web/` : frontend TypeScript + Vite. Sélecteur de moteur en tête, qui bascule les contrôles affichés (réglages Piper vs vitesse Edge TTS) et recharge la liste de voix correspondante.
- `scripts/setup-piper.sh` : télécharge le binaire Piper (release archivée MIT `rhasspy/piper`, pas le fork GPL `OHF-Voice/piper1-gpl`) et des voix depuis `huggingface.co/rhasspy/piper-voices`.

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
npm run setup   # télécharge le binaire piper + voix fr/en, installe server/ et web/
npm run dev      # lance API (http://localhost:3001) et frontend (http://localhost:5173) en parallèle
```

## Suite envisagée

- XTTS-v2 : via un mini-service Python séparé, un Space HuggingFace stable, ou un budget HF validé. Licence Coqui CPML non-commerciale par défaut à vérifier avant tout usage au-delà du test.
- Déploiement sur le VPS OVH (skill `vps-deploy`).
- Intégration dans l'app existante une fois la voix validée.

## Backlog

Pour suivre ce qui reste à faire.

@.doc/BACKLOG.md