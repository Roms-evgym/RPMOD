import express from "express";
import cors from "cors";
import { z } from "zod";
import { createProject, getManifest, getPackPath } from "./store.js";
import { createReadStream, existsSync } from "node:fs";

const app = express();
app.use(cors());
app.use(express.json({ limit: "12mb" }));
app.get("/health", (_req, res) => res.json({ ok: true, service: "rpmod-api" }));

app.post("/api/projects", (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid project name" });
  return res.status(201).json(createProject(parsed.data.name));
});

app.get("/api/projects/:shareCode/manifest", (req, res) => {
  const manifest = getManifest(req.params.shareCode.toUpperCase());
  if (!manifest) return res.status(404).json({ error: "Project not found" });
  return res.json(manifest);
});

app.get("/api/projects/:shareCode/pack.zip", (req, res) => {
  const path = getPackPath(req.params.shareCode.toUpperCase());
  if (!path || !existsSync(path)) return res.status(404).json({ error: "Pack not built yet" });
  res.type("application/zip");
  return createReadStream(path).pipe(res);
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => console.log(`RPMOD API listening on :${port}`));
