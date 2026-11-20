# RPMOD API

Node.js + Express + SQLite API. Run with Node 22+:

```sh
npm install
npm run dev
```

The API currently provides project creation, manifest lookup and ZIP download routes. Next milestone: authenticated item CRUD, deterministic resource-pack builder, per-version pack metadata and automated tests. Edit tokens are returned once and only their SHA-256 hash is persisted.
