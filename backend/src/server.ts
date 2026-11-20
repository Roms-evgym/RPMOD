import express from "express";
import cors from "cors";
import { z } from "zod";
import { createProject, getManifest, getPackPath, canEdit, addCustomItem, removeCustomItem } from "./store.js";
import { createReadStream, existsSync } from "node:fs";
import { buildPack } from "./packBuilder.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "12mb" }));
app.get("/health", (_req, res) => res.json({ ok: true, service: "rpmod-api" }));

app.post("/api/projects", async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid project name" });
  const created = createProject(parsed.data.name);
  await buildPack(created.manifest);
  return res.status(201).json(created);
});

app.get("/api/projects/:shareCode/manifest", (req, res) => {
  const manifest = getManifest(req.params.shareCode.toUpperCase());
  if (!manifest) return res.status(404).json({ error: "Project not found" });
  return res.json(manifest);
});

const itemSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,47}$/),
  baseItem: z.string().regex(/^[a-z0-9_.-]+:[a-z0-9_./-]+$/).default("minecraft:paper"),
  baseItemName: z.string().trim().min(1).max(80),
  renameTrigger: z.string().trim().min(1).max(80),
  category: z.enum(["weapon", "tool", "food", "decoration", "other"]).default("other"),
  iconBase64: z.string().max(8_000_000).optional()
});

app.post("/api/projects/:shareCode/items", async (req, res) => {
  const code = req.params.shareCode.toUpperCase();
  const token = req.header("x-rpmod-edit-token") ?? "";
  if (!canEdit(code, token)) return res.status(403).json({ error: "Invalid edit token" });
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid item data", details: parsed.error.flatten() });
  try {
    const manifest = addCustomItem(code, parsed.data);
    if (!manifest) return res.status(404).json({ error: "Project not found" });
    await buildPack(manifest);
    return res.status(201).json(manifest);
  } catch (error) {
    return res.status(409).json({ error: error instanceof Error ? error.message : "Could not add item" });
  }
});

app.delete("/api/projects/:shareCode/items/:itemId", async (req, res) => {
  const code = req.params.shareCode.toUpperCase();
  const token = req.header("x-rpmod-edit-token") ?? "";
  if (!canEdit(code, token)) return res.status(403).json({ error: "Invalid edit token" });
  const manifest = removeCustomItem(code, req.params.itemId);
  if (!manifest) return res.status(404).json({ error: "Project not found" });
  await buildPack(manifest);
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
