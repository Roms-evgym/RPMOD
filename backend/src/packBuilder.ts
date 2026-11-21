import archiver from "archiver";
import { createWriteStream, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { deflateSync } from "node:zlib";
import type { ProjectManifest, CustomItem } from "./store.js";

const builds = new Map<string, Promise<void>>();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
function fallbackTexture(category: CustomItem["category"]): Buffer {
  const colors: Record<CustomItem["category"], [number, number, number]> = {
    weapon: [190, 74, 67], tool: [76, 145, 190], food: [220, 155, 66],
    decoration: [144, 112, 190], other: [125, 160, 145]
  };
  const [r, g, b] = colors[category];
  const scanlines: Buffer[] = [];
  for (let y = 0; y < 16; y++) {
    const line = Buffer.alloc(1 + 16 * 4); line[0] = 0;
    for (let x = 0; x < 16; x++) {
      const offset = 1 + x * 4;
      const border = x === 0 || x === 15 || y === 0 || y === 15;
      const highlight = x >= 5 && x <= 10 && y >= 5 && y <= 10 && (x === y || x + y === 15);
      line[offset] = border ? 35 : highlight ? 245 : r;
      line[offset + 1] = border ? 40 : highlight ? 225 : g;
      line[offset + 2] = border ? 48 : highlight ? 175 : b;
      line[offset + 3] = 255;
    }
    scanlines.push(line);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(16, 0); header.writeUInt32BE(16, 4);
  header[8] = 8; header[9] = 6; header[10] = 0; header[11] = 0; header[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(Buffer.concat(scanlines))),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}
function itemTexture(item: CustomItem): Buffer {
  let bundledTexture: string | undefined;
  if (item.modelJson) {
    try {
      const document = JSON.parse(item.modelJson) as Record<string, unknown>;
      if (typeof document.rpmodItemTexture === "string") bundledTexture = document.rpmodItemTexture;
    } catch { /* The model validation below reports malformed model JSON. */ }
  }
  const source = item.iconBase64 || bundledTexture;
  if (!source) return fallbackTexture(item.category);
  const raw = source.replace(/^data:image\/png;base64,/, "");
  const image = Buffer.from(raw, "base64");
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (image.length < 24 || !image.subarray(0, 8).equals(signature)) {
    throw new Error(`Item "${item.id}" hat kein gültiges PNG-Bild. Bitte lade eine PNG-Datei hoch.`);
  }
  const width = image.readUInt32BE(16), height = image.readUInt32BE(20);
  if (!width || !height || width > 1024 || height > 1024) {
    throw new Error(`PNG-Größe für "${item.id}" muss zwischen 1 und 1024 Pixeln liegen.`);
  }
  return image;
}
function safeFileName(id: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{1,47}$/.test(id)) throw new Error("Ungültige Item-ID im Projektmanifest");
  return id;
}
function buildArchive(manifest: ProjectManifest): Promise<void> {
  const target = join("storage", manifest.shareCode, "pack.zip");
  mkdirSync(dirname(target), { recursive: true });
  const temporary = target + "." + randomBytes(5).toString("hex") + ".tmp";
  const output = createWriteStream(temporary);
  const archive = archiver("zip", { zlib: { level: 9 } });
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      try { output.destroy(); } catch {}
      try { rmSync(temporary, { force: true }); } catch {}
      reject(error);
    };
    output.once("close", () => {
      try { renameSync(temporary, target); settled = true; resolve(); }
      catch (error) { fail(error as Error); }
    });
    output.once("error", fail);
    archive.once("error", fail);
    archive.pipe(output);

    const packMeta = {
      pack: {
        description: `RPMOD · ${manifest.name} · Minecraft 26.3`,
        min_format: [97, 1],
        max_format: 97
      }
    };
    archive.append(JSON.stringify(packMeta, null, 2) + "\n", { name: "pack.mcmeta" });
    archive.append("# RPMOD resource pack\n\nMinecraft Java 26.3.\n\n", { name: "README.txt" });

    const commands: string[] = [
      "# Give-Kommandos (Cheats oder Operator-Rechte erforderlich)"
    ];
    for (const item of manifest.customItems) {
      const id = safeFileName(item.id);
      const projectPrefix = manifest.shareCode.toLowerCase();
      const itemModelId = `rpmod:${projectPrefix}/${id}`;
      const modelId = `rpmod:item/${projectPrefix}/${id}`;
      const textureId = `rpmod:item/${projectPrefix}/${id}`;
      archive.append(JSON.stringify({
        model: { type: "minecraft:model", model: modelId }
      }, null, 2) + "\n", { name: `assets/rpmod/items/${projectPrefix}/${id}.json` });
      let model: Record<string, unknown>;
      if (item.modelJson) {
        try {
          model = JSON.parse(item.modelJson) as Record<string, unknown>;
        } catch {
          throw new Error(`Das 3D-Modell für "${id}" enthält ungültiges JSON.`);
        }
        if (!Array.isArray(model.elements)) throw new Error(`Das 3D-Modell für "${id}" benötigt ein elements-Array.`);
        const oldTextures = model.textures && typeof model.textures === "object" ? model.textures as Record<string, unknown> : {};
        const faceData = model.rpmodFaceTextures && typeof model.rpmodFaceTextures === "object"
          ? model.rpmodFaceTextures as Record<string, Record<string, string>> : {};
        delete model.rpmodFaceTextures;
        // The inventory/icon PNG is bundled with the model in the database,
        // but exported as its normal standalone Minecraft texture file.
        delete model.rpmodItemTexture;
        const resolvedTextures: Record<string, string> = {};
        for (const [key, value] of Object.entries(oldTextures)) {
          const match = /^part_([a-z0-9_-]+)_(north|south|east|west|up|down)$/.exec(key);
          if (!match) {
            resolvedTextures[key] = textureId;
            continue;
          }
          const [, partId, face] = match;
          const dataUrl = faceData[partId]?.[face];
          if (!dataUrl) {
            resolvedTextures[key] = textureId;
            continue;
          }
          const raw = dataUrl.replace(/^data:image\/png;base64,/, "");
          const image = Buffer.from(raw, "base64");
          const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
          if (image.length < 24 || !image.subarray(0, 8).equals(signature)) {
            throw new Error(`Ungültige Textur für Würfel "${partId}" (Seite: ${face}).`);
          }
          const faceTextureId = `rpmod:item/${projectPrefix}/${id}_${partId}_${face}`;
          resolvedTextures[key] = faceTextureId;
          archive.append(image, { name: `assets/rpmod/textures/item/${projectPrefix}/${id}_${partId}_${face}.png` });
        }
        resolvedTextures["0"] = textureId;
        resolvedTextures.particle = textureId;
        model.textures = resolvedTextures;
      } else {
        model = { parent: "minecraft:item/generated", textures: { layer0: textureId } };
      }
      archive.append(JSON.stringify(model, null, 2) + "\n", { name: `assets/rpmod/models/item/${projectPrefix}/${id}.json` });
      archive.append(itemTexture(item), { name: `assets/rpmod/textures/item/${projectPrefix}/${id}.png` });
      commands.push(`# ${item.renameTrigger} · ${item.baseItemName}`);
      commands.push(`/give @p ${item.baseItem}[minecraft:item_model="${itemModelId}"] 1`);
    }
    const byBaseItem = new Map<string, CustomItem[]>();
    for (const item of manifest.customItems) {
      const list = byBaseItem.get(item.baseItem) ?? [];
      list.push(item);
      byBaseItem.set(item.baseItem, list);
    }
    for (const [baseItem, items] of byBaseItem) {
      const [namespace, ...pathParts] = baseItem.includes(":") ? baseItem.split(":") : ["minecraft", baseItem];
      const path = pathParts.join(":");
      const cases = items.map(item => ({
        when: { text: `${manifest.name}:${item.renameTrigger}` },
        model: { type: "minecraft:model", model: `rpmod:item/${manifest.shareCode.toLowerCase()}/${safeFileName(item.id)}` }
      }));
      const definition = {
        model: {
          type: "minecraft:select",
          property: "minecraft:component",
          component: "minecraft:custom_name",
          cases,
          fallback: { type: "minecraft:model", model: `${namespace}:item/${path}` }
        }
      };
      archive.append(JSON.stringify(definition, null, 2) + "\n", { name: `assets/${namespace}/items/${path}.json` });
    }
    archive.append(commands.join("\n") + "\n", { name: "rpmod-give-commands.txt" });
    archive.finalize().catch((error: Error) => fail(error));
  });
}
export function buildPack(manifest: ProjectManifest): Promise<void> {
  const previous = builds.get(manifest.shareCode) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(() => buildArchive(manifest));
  builds.set(manifest.shareCode, current);
  return current.finally(() => {
    if (builds.get(manifest.shareCode) === current) builds.delete(manifest.shareCode);
  });
}
