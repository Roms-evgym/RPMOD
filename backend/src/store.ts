import Database from "better-sqlite3";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export type ItemCategory = "weapon" | "tool" | "food" | "decoration" | "other";
export type CustomItem = {
  id: string; baseItem: string; baseItemName: string; renameTrigger: string;
  category: ItemCategory; iconBase64?: string; modelJson?: string; modelPath: string; texturePath: string;
};
export type ProjectManifest = {
  shareCode: string; name: string; packHash: string; packFormat: number;
  gameVersions: string[]; customItems: CustomItem[];
};

mkdirSync("storage", { recursive: true });
const db = new Database("storage/rpmod.sqlite");
db.pragma("journal_mode = WAL");
db.exec(`CREATE TABLE IF NOT EXISTS projects (
  share_code TEXT PRIMARY KEY, name TEXT NOT NULL, edit_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL, pack_hash TEXT NOT NULL, manifest_json TEXT NOT NULL
)`);

function makeCode() { return "RPM-" + randomBytes(3).toString("hex").toUpperCase(); }
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function persist(manifest: ProjectManifest) {
  const canonical = JSON.stringify({ ...manifest, packHash: "" });
  manifest.packHash = hash(canonical);
  db.prepare("UPDATE projects SET pack_hash=?, manifest_json=? WHERE share_code=?")
    .run(manifest.packHash, JSON.stringify(manifest), manifest.shareCode);
}
export function createProject(name: string) {
  let shareCode = makeCode();
  while (db.prepare("SELECT 1 FROM projects WHERE share_code=?").get(shareCode)) shareCode = makeCode();
  const editToken = randomBytes(32).toString("base64url");
  const manifest: ProjectManifest = {
    shareCode, name, packHash: "", packFormat: 97.1, gameVersions: ["26.3"], customItems: []
  };
  manifest.packHash = hash(JSON.stringify({ ...manifest, packHash: "" }));
  db.prepare("INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?)").run(
    shareCode, name, hash(editToken), new Date().toISOString(), manifest.packHash, JSON.stringify(manifest)
  );
  return { shareCode, editToken, manifest };
}
export function getManifest(code: string): ProjectManifest | undefined {
  const row = db.prepare("SELECT manifest_json FROM projects WHERE share_code=?").get(code) as {manifest_json:string}|undefined;
  return row ? JSON.parse(row.manifest_json) as ProjectManifest : undefined;
}
export function canEdit(code: string, token: string): boolean {
  const row = db.prepare("SELECT edit_token_hash FROM projects WHERE share_code=?").get(code) as {edit_token_hash:string}|undefined;
  if (!row) return false;
  const supplied = Buffer.from(hash(token), "hex");
  const stored = Buffer.from(row.edit_token_hash, "hex");
  return supplied.length === stored.length && timingSafeEqual(supplied, stored);
}
export function addCustomItem(code: string, item: Omit<CustomItem, "modelPath" | "texturePath">): ProjectManifest | undefined {
  const manifest = getManifest(code);
  if (!manifest) return undefined;
  if (manifest.customItems.some(existing => existing.id === item.id)) throw new Error("An item with this id already exists");
  manifest.customItems.push({
    ...item,
    modelPath: `rpmod:item/${code.toLowerCase()}/${item.id}`,
    texturePath: `rpmod:item/${code.toLowerCase()}/${item.id}`
  });
  persist(manifest);
  return manifest;
}
export function removeCustomItem(code: string, itemId: string): ProjectManifest | undefined {
  const manifest = getManifest(code);
  if (!manifest) return undefined;
  const before = manifest.customItems.length;
  manifest.customItems = manifest.customItems.filter(item => item.id !== itemId);
  if (before !== manifest.customItems.length) persist(manifest);
  return manifest;
}
export function getPackPath(code: string) {
  return /^[A-Z0-9-]{4,20}$/.test(code) ? join("storage", code, "pack.zip") : undefined;
}
