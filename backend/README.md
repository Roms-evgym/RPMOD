# RPMOD API

Node.js 22+ · Express · SQLite · TypeScript.

```sh
npm install
npm run dev
```

The API listens on port `8787` by default. Set `PORT` to change it.

## Routes

- `POST /api/projects` — create a project; returns its share code, manifest and one-time edit token.
- `GET /api/projects/:shareCode/manifest` — read a public project manifest.
- `POST /api/projects/:shareCode/items` — add an item. Requires the `x-rpmod-edit-token` header.
- `DELETE /api/projects/:shareCode/items/:itemId` — remove an item. Requires the edit-token header.
- `GET /api/projects/:shareCode/pack.zip` — download the generated Minecraft Java 26.3 resource pack.
- `GET /health` — service health check.

## Item payload

```json
{
  "id": "ruby-wand",
  "baseItem": "minecraft:stick",
  "baseItemName": "Stock",
  "renameTrigger": "Rubinstab",
  "category": "weapon",
  "iconBase64": "data:image/png;base64,...",
  "modelJson": "{...}"
}
```

`iconBase64` is optional. It must contain a PNG (up to 1024 × 1024 pixels); if omitted, RPMOD generates a simple category-colored placeholder texture. Item IDs are lowercase and limited to letters, digits, underscores and hyphens.

## Resource-pack output

The ZIP contains `pack.mcmeta` for resource pack format 97.1 (Minecraft 26.3), plus a project-scoped item definition, generated item model and PNG texture for each item under the `rpmod` namespace. A vanilla item definition uses the `minecraft:component` select property on `minecraft:custom_name`, mapping the exact anvil rename trigger to that item's model while preserving a fallback to the base item. The ZIP also includes `rpmod-give-commands.txt` with direct test commands that set the `minecraft:item_model` component.

The manifest's SHA-256 `packHash` changes when project items or their texture data change. Edit tokens are returned only at project creation; only their SHA-256 hashes are stored.

Project data and generated archives are stored in the backend's local `storage/` directory. Back up this directory when deploying the API.
