package de.rpmod;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

public final class AnvilRecipeStore {
    public record Recipe(String shareCode, String id, String baseItem, String baseItemName, String renameTrigger) {}
    private static volatile List<Recipe> cached = List.of();

    private AnvilRecipeStore() {}

    public static List<Recipe> getRecipes() {
        return cached;
    }

    public static void reload() {
        List<Recipe> recipes = new ArrayList<>();
        try (Stream<Path> directories = Files.list(RPMODClient.projectsDirectory)) {
            for (Path directory : directories.filter(Files::isDirectory).toList()) {
                Path manifestPath = directory.resolve("manifest.json");
                if (!Files.exists(manifestPath)) continue;
                try (var reader = Files.newBufferedReader(manifestPath)) {
                    JsonObject manifest = JsonParser.parseReader(reader).getAsJsonObject();
                    String code = manifest.get("shareCode").getAsString();
                    JsonArray items = manifest.getAsJsonArray("customItems");
                    if (items == null) continue;
                    for (var element : items) {
                        JsonObject item = element.getAsJsonObject();
                        recipes.add(new Recipe(
                            code,
                            item.get("id").getAsString(),
                            item.get("baseItem").getAsString(),
                            item.get("baseItemName").getAsString(),
                            item.get("renameTrigger").getAsString()
                        ));
                    }
                } catch (Exception exception) {
                    RPMODClient.LOGGER.warn("Could not read local RPMOD manifest in {}", directory, exception);
                }
            }
        } catch (Exception exception) {
            RPMODClient.LOGGER.warn("Could not load local RPMOD recipes", exception);
        }
        recipes.sort(Comparator.comparing(Recipe::renameTrigger, String.CASE_INSENSITIVE_ORDER));
        cached = List.copyOf(recipes);
    }
}
