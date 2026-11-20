package de.rpmod;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

public final class CombinedPackBuilder {
    private CombinedPackBuilder() {}

    public static String rebuild() throws IOException {
        Map<String, byte[]> assets = new LinkedHashMap<>();
        Map<String, JsonArray> casesByBaseItem = new LinkedHashMap<>();
        Map<String, String> fallbackByBaseItem = new LinkedHashMap<>();
        StringBuilder hashSource = new StringBuilder();
        int itemCount = 0;

        try (Stream<Path> directories = Files.list(RPMODClient.projectsDirectory)) {
            for (Path directory : directories.filter(Files::isDirectory).toList()) {
                Path manifestPath = directory.resolve("manifest.json");
                Path packPath = directory.resolve("pack.zip");
                if (!Files.exists(manifestPath) || !Files.exists(packPath)) continue;

                JsonObject manifest;
                try (var reader = Files.newBufferedReader(manifestPath)) {
                    manifest = JsonParser.parseReader(reader).getAsJsonObject();
                }
                String shareCode = manifest.get("shareCode").getAsString();
                String projectHash = manifest.get("packHash").getAsString();
                hashSource.append(shareCode).append(':').append(projectHash).append(';');
                JsonArray items = manifest.getAsJsonArray("customItems");
                if (items != null) {
                    for (var element : items) {
                        JsonObject item = element.getAsJsonObject();
                        String baseItem = item.get("baseItem").getAsString();
                        String[] parts = splitItemId(baseItem);
                        String namespace = parts[0];
                        String itemPath = parts[1];
                        String assetPath = "assets/" + namespace + "/items/" + itemPath + ".json";
                        JsonArray cases = casesByBaseItem.computeIfAbsent(assetPath, ignored -> new JsonArray());
                        String trigger = item.get("renameTrigger").getAsString();
                        String id = item.get("id").getAsString();
                        JsonObject when = new JsonObject();
                        when.addProperty("text", trigger);
                        JsonObject model = new JsonObject();
                        model.addProperty("type", "minecraft:model");
                        model.addProperty("model", "rpmod:item/" + shareCode.toLowerCase() + "/" + id);
                        JsonObject match = new JsonObject();
                        match.add("when", when);
                        match.add("model", model);
                        cases.add(match);
                        fallbackByBaseItem.put(assetPath, namespace + ":item/" + itemPath);
                        itemCount++;
                    }
                }

                try (InputStream input = Files.newInputStream(packPath); ZipInputStream zip = new ZipInputStream(input)) {
                    ZipEntry entry;
                    while ((entry = zip.getNextEntry()) != null) {
                        String name = entry.getName();
                        if (entry.isDirectory() || name.equals("pack.mcmeta") || name.equals("README.txt")
                            || name.equals("rpmod-give-commands.txt")) continue;
                        if (isBaseItemDefinition(name)) continue;
                        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                        zip.transferTo(buffer);
                        assets.putIfAbsent(name, buffer.toByteArray());
                        zip.closeEntry();
                    }
                }
            }
        }

        if (itemCount == 0) return null;

        for (Map.Entry<String, JsonArray> entry : casesByBaseItem.entrySet()) {
            JsonObject model = new JsonObject();
            model.addProperty("type", "minecraft:select");
            model.addProperty("property", "minecraft:component");
            model.addProperty("component", "minecraft:custom_name");
            model.add("cases", entry.getValue());
            String fallbackId = fallbackByBaseItem.get(entry.getKey());
            JsonObject fallback = new JsonObject();
            fallback.addProperty("type", "minecraft:model");
            fallback.addProperty("model", fallbackId);
            JsonObject definition = new JsonObject();
            definition.add("model", model);
            model.add("fallback", fallback);
            assets.put(entry.getKey(), definition.toString().getBytes(StandardCharsets.UTF_8));
        }

        String digest = sha256(hashSource.toString()).substring(0, 10);
        String fileName = "RPMOD_Combined_" + digest + ".zip";
        Path resourcePacks = net.minecraft.client.Minecraft.getInstance().getResourcePackDirectory();
        Files.createDirectories(resourcePacks);
        Path target = resourcePacks.resolve(fileName);
        Path temporary = target.resolveSibling(fileName + ".tmp");

        JsonObject pack = new JsonObject();
        JsonArray min = new JsonArray(); min.add(97); min.add(1);
        JsonObject metadata = new JsonObject();
        metadata.add("min_format", min);
        metadata.addProperty("max_format", 97);
        metadata.addProperty("description", "RPMOD · Combined projects · Minecraft 26.3");
        pack.add("pack", metadata);

        try (ZipOutputStream output = new ZipOutputStream(Files.newOutputStream(temporary))) {
            writeEntry(output, "pack.mcmeta", pack.toString().getBytes(StandardCharsets.UTF_8));
            writeEntry(output, "README.txt", "RPMOD combined resource pack. Generated from your joined projects.\n".getBytes(StandardCharsets.UTF_8));
            for (Map.Entry<String, byte[]> asset : assets.entrySet()) writeEntry(output, asset.getKey(), asset.getValue());
        } catch (IOException exception) {
            Files.deleteIfExists(temporary);
            throw exception;
        }
        try {
            Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (java.nio.file.AtomicMoveNotSupportedException ignored) {
            Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING);
        }
        return fileName;
    }

    private static boolean isBaseItemDefinition(String path) {
        if (!path.startsWith("assets/") || !path.contains("/items/")) return false;
        String namespace = path.substring("assets/".length(), path.indexOf("/items/"));
        return !namespace.equals("rpmod");
    }

    private static String[] splitItemId(String id) {
        int separator = id.indexOf(':');
        if (separator < 0) return new String[] { "minecraft", id };
        return new String[] { id.substring(0, separator), id.substring(separator + 1) };
    }

    private static void writeEntry(ZipOutputStream output, String name, byte[] bytes) throws IOException {
        output.putNextEntry(new ZipEntry(name));
        output.write(bytes);
        output.closeEntry();
    }

    private static String sha256(String value) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder();
            for (byte b : hash) result.append(String.format("%02x", b));
            return result.toString();
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }
}
