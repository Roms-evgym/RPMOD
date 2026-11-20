# RPMOD

A shared Minecraft resource-pack workspace with a Fabric client mod, web editor and pack builder.

## Project status

This repository is being built in stages. The first milestone establishes the API contract, project storage and client integration skeleton. Minecraft/Fabric versions are pinned only after their official mappings, loader and API artifacts are verified.

## Components

- `fabric-mod/` — Fabric client mod: join/leave projects, sync packs and anvil helper.
- `backend/` — Node.js API, project manifests and resource-pack ZIP generation.
- `web/` — React + TypeScript editor and project sharing UI.
- `shared/` — API and item schemas shared across services.

## Development

See the component READMEs for setup. Do not put admin tokens or deployment secrets in the repository.

## Security

Share codes are identifiers, not admin credentials. Project edit tokens must be stored hashed by the backend and transmitted only over HTTPS.
