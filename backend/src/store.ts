import { Pool } from "pg";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

export type ItemCategory = "weapon" | "tool" | "food" | "decoration" | "other";
export type CustomItem = {
  id: string; baseItem: string; baseItemName: string; renameTrigger: string;
  category: ItemCategory; iconBase64?: string; modelJson?: string; modelPath: string; texturePath: string;
};
export type ProjectManifest = {
  shareCode: string; name: string; packHash: string; packFormat: number;
  gameVersions: string[]; customItems: CustomItem[];
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL environment variable is required");
export const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
  max: Number(process.env.PG_POOL_MAX ?? 5),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000
});

export async function initializeStore() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      share_code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      edit_token_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      pack_hash TEXT NOT NULL,
      manifest_json JSONB NOT NULL
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS projects_created_at_idx ON projects (created_at DESC)");
}

function makeCode() { return "RPM-" + randomBytes(3).toString("hex").toUpperCase(); }
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function updateHash(manifest: ProjectManifest) {
  manifest.packHash = hash(JSON.stringify({ ...manifest, packHash: "" }));
}
async function persist(client: import("pg").PoolClient, manifest: ProjectManifest) {
  updateHash(manifest);
  await client.query(
    "UPDATE projects SET pack_hash=$1, manifest_json=$2::jsonb WHERE share_code=$3",
    [manifest.packHash, JSON.stringify(manifest), manifest.shareCode]
  );
}
export async function createProject(name: string) {
  const editToken = randomBytes(32).toString("base64url");
  const manifest: ProjectManifest = {
    shareCode: makeCode(), name, packHash: "", packFormat: 97.1,
    gameVersions: ["26.3"], customItems: []
  };
  updateHash(manifest);
  await pool.query(
    "INSERT INTO projects (share_code,name,edit_token_hash,pack_hash,manifest_json) VALUES ($1,$2,$3,$4,$5::jsonb)",
    [manifest.shareCode, name, hash(editToken), manifest.packHash, JSON.stringify(manifest)]
  );
  return { shareCode: manifest.shareCode, editToken, manifest };
}
export async function getManifest(code: string): Promise<ProjectManifest | undefined> {
  const result = await pool.query("SELECT manifest_json FROM projects WHERE share_code=$1", [code]);
  return result.rowCount ? result.rows[0].manifest_json as ProjectManifest : undefined;
}
export async function canEdit(code: string, token: string): Promise<boolean> {
  const result = await pool.query("SELECT edit_token_hash FROM projects WHERE share_code=$1", [code]);
  if (!result.rowCount) return false;
  const supplied = Buffer.from(hash(token), "hex");
  const stored = Buffer.from(result.rows[0].edit_token_hash, "hex");
  return supplied.length === stored.length && timingSafeEqual(supplied, stored);
}
export async function addCustomItem(code: string, item: Omit<CustomItem, "modelPath" | "texturePath">): Promise<ProjectManifest | undefined> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT manifest_json FROM projects WHERE share_code=$1 FOR UPDATE", [code]);
    if (!result.rowCount) { await client.query("ROLLBACK"); return undefined; }
    const manifest = result.rows[0].manifest_json as ProjectManifest;
    if (manifest.customItems.some(existing => existing.id === item.id)) throw new Error("An item with this id already exists");
    if (manifest.customItems.some(existing => existing.baseItem === item.baseItem && existing.renameTrigger.toLocaleLowerCase() === item.renameTrigger.toLocaleLowerCase())) {
      throw new Error("This rename trigger is already used for the selected base item");
    }
    manifest.customItems.push({
      ...item,
      modelPath: `rpmod:item/${code.toLowerCase()}/${item.id}`,
      texturePath: `rpmod:item/${code.toLowerCase()}/${item.id}`
    });
    await persist(client, manifest);
    await client.query("COMMIT");
    return manifest;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function removeCustomItem(code: string, itemId: string): Promise<ProjectManifest | undefined> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT manifest_json FROM projects WHERE share_code=$1 FOR UPDATE", [code]);
    if (!result.rowCount) { await client.query("ROLLBACK"); return undefined; }
    const manifest = result.rows[0].manifest_json as ProjectManifest;
    const before = manifest.customItems.length;
    manifest.customItems = manifest.customItems.filter(item => item.id !== itemId);
    if (before !== manifest.customItems.length) await persist(client, manifest);
    await client.query("COMMIT");
    return manifest;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export function getPackPath(code: string) {
  return /^[A-Z0-9-]{4,20}$/.test(code) ? `storage/${code}/pack.zip` : undefined;
}
