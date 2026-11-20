import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { buildPack } from "../dist/packBuilder.js";

test("exports a valid Minecraft Java 26.3 resource pack", async () => {
  const shareCode = "RPM-TEST01";
  const zipPath = join("storage", shareCode, "pack.zip");
  const manifest = {
    shareCode,
    name: "Automated Test",
    packHash: "0".repeat(64),
    packFormat: 97.1,
    gameVersions: ["26.3"],
    customItems: [{
      id: "ruby-wand",
      baseItem: "minecraft:stick",
      baseItemName: "Stock",
      renameTrigger: "Rubinstab",
      category: "weapon",
      modelPath: "rpmod:item/ruby-wand",
      texturePath: "rpmod:item/ruby-wand"
    }]
  };

  try {
    await buildPack(manifest);
    assert.equal(existsSync(zipPath), true);
    execFileSync("unzip", ["-t", zipPath], { stdio: "pipe" });

    const files = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" }).split(/\r?\n/);
    assert.ok(files.includes("pack.mcmeta"));
    assert.ok(files.includes("assets/rpmod/items/ruby-wand.json"));
    assert.ok(files.includes("assets/rpmod/models/item/ruby-wand.json"));
    assert.ok(files.includes("assets/rpmod/textures/item/ruby-wand.png"));
    assert.ok(files.includes("rpmod-give-commands.txt"));

    const metadata = JSON.parse(execFileSync("unzip", ["-p", zipPath, "pack.mcmeta"], { encoding: "utf8" }));
    assert.deepEqual(metadata.pack.min_format, [97, 1]);
    assert.equal(metadata.pack.max_format, 97);

    const definition = JSON.parse(execFileSync("unzip", ["-p", zipPath, "assets/rpmod/items/ruby-wand.json"], { encoding: "utf8" }));
    assert.equal(definition.model.type, "minecraft:model");
    assert.equal(definition.model.model, "rpmod:ruby-wand");

    const png = execFileSync("unzip", ["-p", zipPath, "assets/rpmod/textures/item/ruby-wand.png"]);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), 16);
    assert.equal(png.readUInt32BE(20), 16);
  } finally {
    rmSync(join("storage", shareCode), { recursive: true, force: true });
  }
});
