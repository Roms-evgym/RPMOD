import Database from "better-sqlite3";
import { randomBytes, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
type ProjectManifest = { shareCode: string; name: string; packHash: string; packFormat: number; gameVersions: string[]; customItems: unknown[] };

mkdirSync("storage", { recursive: true });
const db = new Database("storage/rpmod.sqlite");
db.pragma("journal_mode = WAL");
db.exec(`CREATE TABLE IF NOT EXISTS projects (
  share_code TEXT PRIMARY KEY, name TEXT NOT NULL, edit_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL, pack_hash TEXT NOT NULL, manifest_json TEXT NOT NULL
)`);

function makeCode() { return "RPM-" + randomBytes(3).toString("hex").toUpperCase(); }
export function createProject(name: string) {
  let shareCode = makeCode();
  while (db.prepare("SELECT 1 FROM projects WHERE share_code=?").get(shareCode)) shareCode = makeCode();
  const editToken = randomBytes(32).toString("base64url");
  const manifest: ProjectManifest = {
    shareCode, name, packHash: createHash("sha256").update("").digest("hex"),
    packFormat: 97, gameVersions: ["26.3"], customItems: []
  };
  db.prepare("INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?)").run(
    shareCode, name, createHash("sha256").update(editToken).digest("hex"),
    new Date().toISOString(), manifest.packHash, JSON.stringify(manifest)
  );
  return { shareCode, editToken, manifest };
}
export function getManifest(code: string): ProjectManifest | undefined {
  const row = db.prepare("SELECT manifest_json FROM projects WHERE share_code=?").get(code) as {manifest_json:string}|undefined;
  return row ? JSON.parse(row.manifest_json) as ProjectManifest : undefined;
}
export function getPackPath(code: string) { return /^[A-Z0-9-]{4,20}$/.test(code) ? join("storage", code, "pack.zip") : undefined; }
