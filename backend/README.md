# RPMOD API

Node.js 22+ · Express · PostgreSQL (Supabase) · TypeScript.

## Local development

Create a Supabase project, copy its PostgreSQL connection string into `DATABASE_URL`, then:

```sh
npm install
npm run dev
```

Use the Supabase **Session pooler** connection string when deploying from a host such as Render. Keep the password private. Never put `DATABASE_URL` in the web frontend or commit it to Git.

## Render deployment

This repository includes a root `render.yaml`. Create a new Blueprint in Render and connect `Roms-evgym/RPMOD`. Set the `DATABASE_URL` secret to the Supabase Session pooler connection string. The API listens on Render's `PORT`.

## Routes

- `POST /api/projects` — create a project; returns its share code, manifest and one-time edit token.
- `GET /api/projects/:shareCode/manifest` — read a public project manifest.
- `POST /api/projects/:shareCode/items` — add an item. Requires the `x-rpmod-edit-token` header.
- `DELETE /api/projects/:shareCode/items/:itemId` — remove an item. Requires the edit-token header.
- `GET /api/projects/:shareCode/pack.zip` — generate on demand and download the resource pack.
- `GET /health` — service and database health check.

Project metadata and item data are stored in Supabase PostgreSQL. Resource-pack ZIPs are generated on demand and cached only on the server's temporary filesystem. If the host restarts and clears that cache, the next download regenerates the ZIP from the database.

## Resource-pack output

The ZIP contains `pack.mcmeta` for resource pack format 97.1 (Minecraft 26.3), project-scoped item definitions, generated item models and PNG textures. Edit tokens are returned only at project creation; only their SHA-256 hashes are stored.
