import express from "express";
import cors from "cors";
import { z } from "zod";
import { createProject, getManifest, getPackPath, canEdit, addCustomItem, removeCustomItem, initializeStore, pool } from "./store.js";
import { createReadStream, existsSync } from "node:fs";
import { buildPack } from "./packBuilder.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "24mb" }));
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.json({ ok: true, service: "rpmod-api", database: "connected" });
  } catch {
    return res.status(503).json({ ok: false, service: "rpmod-api", database: "unavailable" });
  }
});

app.post("/api/projects", async (req, res, next) => {
  try {
    const parsed = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid project name" });
    const created = await createProject(parsed.data.name);
    await buildPack(created.manifest);
    return res.status(201).json(created);
  } catch (error) { return next(error); }
});

app.get("/api/projects/:shareCode/manifest", async (req, res, next) => {
  try {
    const manifest = await getManifest(req.params.shareCode.toUpperCase());
    if (!manifest) return res.status(404).json({ error: "Project not found" });
    return res.json(manifest);
  } catch (error) { return next(error); }
});

const itemSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,47}$/),
  baseItem: z.string().regex(/^[a-z0-9_.-]+:[a-z0-9_./-]+$/).default("minecraft:paper"),
  baseItemName: z.string().trim().min(1).max(80),
  renameTrigger: z.string().trim().min(1).max(80),
  category: z.enum(["weapon", "tool", "food", "decoration", "other"]).default("other"),
  iconBase64: z.string().max(8_000_000).optional(),
  // Model JSON also carries the linked item PNG and per-cube face PNGs.
  modelJson: z.string().max(20_000_000).optional()
});

app.post("/api/projects/:shareCode/items", async (req, res, next) => {
  try {
    const code = req.params.shareCode.toUpperCase();
    const token = req.header("x-rpmod-edit-token") ?? "";
    if (!await canEdit(code, token)) return res.status(403).json({ error: "Invalid edit token" });
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid item data", details: parsed.error.flatten() });
    try {
      const manifest = await addCustomItem(code, parsed.data);
      if (!manifest) return res.status(404).json({ error: "Project not found" });
      await buildPack(manifest);
      return res.status(201).json(manifest);
    } catch (error) {
      if (error instanceof Error && (error.message.includes("already exists") || error.message.includes("already used"))) {
        return res.status(409).json({ error: error.message });
      }
      throw error;
    }
  } catch (error) { return next(error); }
});

app.delete("/api/projects/:shareCode/items/:itemId", async (req, res, next) => {
  try {
    const code = req.params.shareCode.toUpperCase();
    const token = req.header("x-rpmod-edit-token") ?? "";
    if (!await canEdit(code, token)) return res.status(403).json({ error: "Invalid edit token" });
    const manifest = await removeCustomItem(code, req.params.itemId);
    if (!manifest) return res.status(404).json({ error: "Project not found" });
    await buildPack(manifest);
    return res.json(manifest);
  } catch (error) { return next(error); }
});

app.get("/api/projects/:shareCode/pack.zip", async (req, res, next) => {
  try {
    const code = req.params.shareCode.toUpperCase();
    const manifest = await getManifest(code);
    if (!manifest) return res.status(404).json({ error: "Project not found" });
    const path = getPackPath(code);
    if (!path) return res.status(400).json({ error: "Invalid share code" });
    if (!existsSync(path)) await buildPack(manifest);
    res.type("application/zip");
    return createReadStream(path).pipe(res);
  } catch (error) { return next(error); }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("RPMOD API error:", error);
  return res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT ?? 8787);
initializeStore().then(() => {
  app.listen(port, () => console.log(`RPMOD API listening on :${port}`));
}).catch(error => {
  console.error("Could not initialize RPMOD database:", error);
  process.exit(1);
});
