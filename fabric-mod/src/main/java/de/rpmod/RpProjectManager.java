package de.rpmod;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.Properties;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

public final class RpProjectManager {
    private static final Pattern CODE = Pattern.compile("RPM-[A-F0-9]{6}");
    private static final Pattern HASH = Pattern.compile("\\\"packHash\\\"\\s*:\\s*\\\"([a-f0-9]{64})\\\"", Pattern.CASE_INSENSITIVE);
    private static final HttpClient HTTP = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10)).followRedirects(HttpClient.Redirect.NORMAL).build();
    private static String apiBase = "https://rpmod-api-w0h8.onrender.com";

    private RpProjectManager() {}

    public static void loadConfig(Path configDirectory) {
        Path config = configDirectory.resolve("config.properties");
        Properties properties = new Properties();
        if (Files.exists(config)) {
            try (var input = Files.newInputStream(config)) { properties.load(input); }
            catch (IOException exception) { RPMODClient.LOGGER.warn("Could not read RPMOD config", exception); }
        } else {
            properties.setProperty("apiBase", apiBase);
            try (var output = Files.newOutputStream(config)) { properties.store(output, "RPMOD API endpoint"); }
            catch (IOException exception) { RPMODClient.LOGGER.warn("Could not create RPMOD config", exception); }
        }
        String configured = properties.getProperty("apiBase", apiBase).trim();
        // Migrate existing installations from the old local-only default to the hosted API.
        if (configured.isBlank() || configured.equals("http://localhost:8787") || configured.equals("http://127.0.0.1:8787")) {
            configured = apiBase;
            properties.setProperty("apiBase", apiBase);
            try (var output = Files.newOutputStream(config)) { properties.store(output, "RPMOD API endpoint"); }
            catch (IOException exception) { RPMODClient.LOGGER.warn("Could not update RPMOD config", exception); }
        }
        apiBase = configured.replaceAll("/+$", "");
        RPMODClient.LOGGER.info("RPMOD API endpoint: {}", apiBase);
    }


    public record CreatedProject(String shareCode, String editToken, String name) {}

    public static void createProject(String name, Consumer<CreatedProject> success, Consumer<String> failure) {
        Thread.startVirtualThread(() -> {
            try {
                String body = "{\"name\":\"" + escapeJson(name) + "\"}";
                HttpResponse<String> response = HTTP.send(
                    HttpRequest.newBuilder(URI.create(apiBase + "/api/projects"))
                        .timeout(Duration.ofSeconds(30))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(body)).build(),
                    HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() != 201) throw new IOException("API antwortete mit HTTP " + response.statusCode());
                Matcher code = Pattern.compile("\\\"shareCode\\\"\\s*:\\s*\\\"(RPM-[A-F0-9]{6})\\\"").matcher(response.body());
                Matcher token = Pattern.compile("\\\"editToken\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"").matcher(response.body());
                if (!code.find() || !token.find()) throw new IOException("API-Antwort enthält keinen Share-Code oder Edit-Token");
                success.accept(new CreatedProject(code.group(1), token.group(1), name));
            } catch (Exception exception) {
                RPMODClient.LOGGER.error("Could not create RPMOD project", exception);
                failure.accept(safeMessage(exception));
            }
        });
    }

    private static String escapeJson(String value) {
        return value.replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r");
    }

    public static String getWebEditorUrl() {
        return "https://roms-evgym.github.io/RPMOD/";
    }

    public static void join(String code, Consumer<String> feedback) {
        if (!validCode(code)) { feedback.accept("Ungültiger Share-Code. Beispiel: RPM-A1B2C3"); return; }
        Thread.startVirtualThread(() -> {
            try {
                syncOne(code, true);
                refreshCombined();
                feedback.accept("Projekt " + code + " wurde geladen. Alle verbundenen Projekte sind gemeinsam aktiviert.");
            } catch (Exception exception) {
                RPMODClient.LOGGER.error("Could not join RPMOD project {}", code, exception);
                feedback.accept("Projekt konnte nicht geladen werden: " + safeMessage(exception));
            }
        });
    }

    public static void syncAll(Consumer<String> feedback) {
        syncAll(feedback, false);
    }

    public static void checkForUpdates() {
        syncAll(message -> RPMODClient.LOGGER.info(message), true);
    }

    private static void syncAll(Consumer<String> feedback, boolean quiet) {
        Thread.startVirtualThread(() -> {
            int checked = 0;
            int changed = 0;
            int failed = 0;
            try (Stream<Path> projects = Files.list(RPMODClient.projectsDirectory)) {
                for (Path directory : projects.filter(Files::isDirectory).toList()) {
                    String code = directory.getFileName().toString();
                    if (!validCode(code)) continue;
                    try {
                        checked++;
                        if (syncOne(code, false)) changed++;
                    } catch (Exception exception) {
                        failed++;
                        RPMODClient.LOGGER.warn("Could not sync RPMOD project {}", code, exception);
                    }
                }
            } catch (IOException exception) {
                feedback.accept("Projektordner konnte nicht gelesen werden: " + safeMessage(exception));
                return;
            }
            if (changed > 0) {
                try {
                    refreshCombined();
                    RPMODClient.LOGGER.info("Automatically installed updates for {} RPMOD project(s).", changed);
                } catch (Exception exception) {
                    failed++;
                    RPMODClient.LOGGER.warn("Could not rebuild combined RPMOD pack", exception);
                }
            }
            String summary = "RPMOD-Updateprüfung: " + checked + " Projekt(e) geprüft, " + changed + " aktualisiert, " + failed + " Fehler.";
            if (!quiet || changed > 0 || failed > 0) feedback.accept(summary);
        });
    }

    public static void leave(String code, Consumer<String> feedback) {
        if (!validCode(code)) { feedback.accept("Ungültiger Share-Code."); return; }
        Thread.startVirtualThread(() -> {
            try {
                deleteTree(RPMODClient.projectsDirectory.resolve(code));
                Files.deleteIfExists(net.minecraft.client.Minecraft.getInstance().getResourcePackDirectory().resolve("RPMOD_" + code + ".zip"));
                refreshCombined();
                feedback.accept("Projekt " + code + " wurde entfernt. Die übrigen Projekte bleiben aktiv.");
            } catch (Exception exception) {
                feedback.accept("Projekt konnte nicht vollständig entfernt werden: " + safeMessage(exception));
            }
        });
    }

    private static boolean syncOne(String code, boolean force) throws Exception {
        Path projectDirectory = RPMODClient.projectsDirectory.resolve(code);
        Files.createDirectories(projectDirectory);
        Path manifestFile = projectDirectory.resolve("manifest.json");
        String oldHash = "";
        if (Files.exists(manifestFile)) {
            Matcher old = HASH.matcher(Files.readString(manifestFile));
            if (old.find()) oldHash = old.group(1);
        }

        String manifestUrl = apiBase + "/api/projects/" + code + "/manifest";
        HttpResponse<String> manifestResponse = HTTP.send(
            HttpRequest.newBuilder(URI.create(manifestUrl)).timeout(Duration.ofSeconds(30)).GET().build(),
            HttpResponse.BodyHandlers.ofString());
        if (manifestResponse.statusCode() != 200) throw new IOException("Manifest-API antwortete mit HTTP " + manifestResponse.statusCode());
        Matcher matcher = HASH.matcher(manifestResponse.body());
        if (!matcher.find()) throw new IOException("Manifest enthält keinen gültigen packHash");
        String newHash = matcher.group(1);

        Path pack = projectDirectory.resolve("pack.zip");
        boolean changed = force || !newHash.equals(oldHash) || !Files.exists(pack);
        if (changed) {
            String packUrl = apiBase + "/api/projects/" + code + "/pack.zip";
            HttpResponse<byte[]> packResponse = HTTP.send(
                HttpRequest.newBuilder(URI.create(packUrl)).timeout(Duration.ofSeconds(60)).GET().build(),
                HttpResponse.BodyHandlers.ofByteArray());
            if (packResponse.statusCode() != 200) throw new IOException("Pack-Download antwortete mit HTTP " + packResponse.statusCode());
            byte[] bytes = packResponse.body();
            if (bytes.length < 22 || bytes.length > 64 * 1024 * 1024 ||
                bytes[0] != 'P' || bytes[1] != 'K') throw new IOException("Die heruntergeladene ZIP-Datei ist ungültig oder zu groß");
            Path temporary = pack.resolveSibling(pack.getFileName() + ".tmp");
            Files.write(temporary, bytes);
            try {
                Files.move(temporary, pack, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } catch (java.nio.file.AtomicMoveNotSupportedException ignored) {
                Files.move(temporary, pack, StandardCopyOption.REPLACE_EXISTING);
            }
        }
        Files.writeString(manifestFile, manifestResponse.body());
        if (changed) AnvilRecipeStore.reload();
        return changed;
    }

    private static void refreshCombined() throws IOException {
        AnvilRecipeStore.reload();
        String combinedPack = CombinedPackBuilder.rebuild();
        if (combinedPack == null) MinecraftClientActions.deactivateCombined(() -> {});
        else MinecraftClientActions.activateCombined(combinedPack);
    }

    private static boolean validCode(String code) { return CODE.matcher(code).matches(); }
    private static String safeMessage(Exception exception) {
        return exception.getMessage() == null ? exception.getClass().getSimpleName() : exception.getMessage();
    }
    private static void deleteTree(Path path) throws IOException {
        if (!Files.exists(path)) return;
        try (Stream<Path> files = Files.walk(path)) {
            for (Path file : files.sorted(java.util.Comparator.reverseOrder()).toList()) Files.deleteIfExists(file);
        }
    }
}
