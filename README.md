# TTS-test

Projet de test de moteurs de synthèse vocale : Piper (local) et Edge TTS (Microsoft, gratuit non-officiel). Voir [AGENTS.md](AGENTS.md) pour le contexte et les décisions d'architecture.

## Installation

```bash
npm install
npm run setup
```

`npm run setup` télécharge le binaire Piper dans `server/bin/` et deux voix (français, anglais) dans `server/voices/`, puis installe les dépendances de `server/` et `web/`.

## Lancement en développement

```bash
npm run dev
```

Lance le serveur (`http://localhost:3001`) et le frontend (`http://localhost:5173`) en parallèle depuis la racine. Le frontend proxifie les appels `/api` vers le serveur.

## Ajouter une voix

1. Trouver la voix voulue sur [huggingface.co/rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices).
2. Télécharger le `.onnx` et le `.onnx.json` correspondants dans `server/voices/`.
3. Redémarrer le serveur : la voix apparaît automatiquement dans le sélecteur.

## Build production

```bash
cd web && npm run build
cd ../server && npm run build && npm start
```

Le serveur sert alors le frontend buildé (`web/dist`) en plus de l'API.
