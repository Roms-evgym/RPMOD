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
    assert.ok(files.includes("assets/rpmod/items/rpm-test01/ruby-wand.json"));
    assert.ok(files.includes("assets/rpmod/models/item/rpm-test01/ruby-wand.json"));
    assert.ok(files.includes("assets/rpmod/textures/item/rpm-test01/ruby-wand.png"));
    assert.ok(files.includes("rpmod-give-commands.txt"));

    const metadata = JSON.parse(execFileSync("unzip", ["-p", zipPath, "pack.mcmeta"], { encoding: "utf8" }));
    assert.deepEqual(metadata.pack.min_format, [97, 1]);
    assert.equal(metadata.pack.max_format, 97);

    const definition = JSON.parse(execFileSync("unzip", ["-p", zipPath, "assets/rpmod/items/rpm-test01/ruby-wand.json"], { encoding: "utf8" }));
    assert.equal(definition.model.type, "minecraft:model");
    assert.equal(definition.model.model, "rpmod:item/rpm-test01/ruby-wand");
    const anvilDefinition = JSON.parse(execFileSync("unzip", ["-p", zipPath, "assets/minecraft/items/stick.json"], { encoding: "utf8" }));
    assert.equal(anvilDefinition.model.property, "minecraft:component");
    assert.equal(anvilDefinition.model.component, "minecraft:custom_name");
    assert.equal(anvilDefinition.model.cases[0].when.text, "Automated Test:Rubinstab");
    assert.equal(anvilDefinition.model.cases[0].model.model, "rpmod:item/rpm-test01/ruby-wand");

    const png = execFileSync("unzip", ["-p", zipPath, "assets/rpmod/textures/item/rpm-test01/ruby-wand.png"]);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), 16);
    assert.equal(png.readUInt32BE(20), 16);
  } finally {
    rmSync(join("storage", shareCode), { recursive: true, force: true });
  }
});

test("exports saved 3D cuboids with the project's texture id", async () => {
  const shareCode = "RPM-TEST02";
  const zipPath = join("storage", shareCode, "pack.zip");
  const modelJson = JSON.stringify({
    parent: "minecraft:block/block",
    textures: { "0": "rpmod:item/__texture__", particle: "rpmod:item/__texture__" },
    elements: [{
      from: [4, 3, 4],
      to: [12, 13, 12],
      faces: {
        north: { uv: [0, 0, 16, 16], texture: "#0" },
        south: { uv: [0, 0, 16, 16], texture: "#0" },
        east: { uv: [0, 0, 16, 16], texture: "#0" },
        west: { uv: [0, 0, 16, 16], texture: "#0" },
        up: { uv: [0, 0, 16, 16], texture: "#0" },
        down: { uv: [0, 0, 16, 16], texture: "#0" }
      }
    }]
  });
  const manifest = {
    shareCode, name: "3D Model Test", packHash: "1".repeat(64), packFormat: 97.1,
    gameVersions: ["26.3"],
    customItems: [{
      id: "cube-item", baseItem: "minecraft:paper", baseItemName: "Papier",
      renameTrigger: "Cube", category: "decoration", modelJson
    }]
  };

  try {
    await buildPack(manifest);
    const model = JSON.parse(execFileSync("unzip", ["-p", zipPath, "assets/rpmod/models/item/rpm-test02/cube-item.json"], { encoding: "utf8" }));
    assert.equal(model.parent, "minecraft:block/block");
    assert.equal(model.elements.length, 1);
    assert.deepEqual(model.elements[0].from, [4, 3, 4]);
    assert.equal(model.textures["0"], "rpmod:item/rpm-test02/cube-item");
    assert.equal(model.textures.particle, "rpmod:item/rpm-test02/cube-item");
  } finally {
    rmSync(join("storage", shareCode), { recursive: true, force: true });
  }
});
