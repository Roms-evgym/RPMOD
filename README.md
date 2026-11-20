# RPMOD

A shared Minecraft Java resource-pack workspace with a React editor, Node.js API, automatic pack builder and Fabric client mod.

## Current milestone

The current working target is Minecraft Java 26.3, Fabric Loader 0.20.1 and Java 25.

Implemented and CI-verified:
- Create projects with short share codes and private edit tokens.
- Join a project in the browser and inspect its saved items.
- Add and delete custom items through authenticated API routes.
- Upload PNG textures or use generated category placeholders.
- Build a Three.js cuboid model with editable coordinates and a live 3D preview.
- Export item definitions, custom models and textures into a Minecraft 26.3 resource-pack ZIP.
- Run `/rp join <SHARECODE>`, `/rp sync`, `/rp leave <SHARECODE>` and `/rp help` in the Fabric client.
- Automatically select downloaded packs in Minecraft and reload resources when packs change.
- Automated backend tests verify ZIP structure, metadata, PNG output and 3D model export.

Not yet implemented: the advanced UV pixel painter, full Blockbench import/export workflow, Anvil-screen recipe sidebar, in-game project GUI and multi-version 26.1/26.2 builds.

## Components

- `fabric-mod/` — Fabric client mod and local project synchronization.
- `backend/` — Express API, SQLite project storage and ZIP resource-pack builder.
- `web/` — React + TypeScript project workspace and Three.js cuboid editor.
- `shared/` — shared project and item types.

## Quick setup

Backend:

```sh
cd backend
npm install
npm run dev
```

Web editor:

```sh
cd web
npm install
npm run dev
```

The Fabric mod reads its API base URL from `.minecraft/config/rpmod/config.properties`. The default `http://localhost:8787` works only when the backend is running on the same computer. For remote players, configure a public HTTPS API URL.

See the component READMEs for details. Never commit edit tokens or deployment secrets.

## Security

Share codes are public identifiers, not admin credentials. Edit tokens are returned once at project creation, stored hashed by the backend, and sent to authenticated edit endpoints. Use HTTPS when the API is exposed to the internet.
