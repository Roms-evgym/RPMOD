package de.rpmod;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.loader.api.FabricLoader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.nio.file.Path;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public final class RPMODClient implements ClientModInitializer {
    public static final String MOD_ID = "rpmod";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);
    public static Path configDirectory;
    public static Path projectsDirectory;

    @Override
    public void onInitializeClient() {
        configDirectory = FabricLoader.getInstance().getConfigDir().resolve(MOD_ID);
        projectsDirectory = configDirectory.resolve("projects");
        try {
            java.nio.file.Files.createDirectories(projectsDirectory);
            RpProjectManager.loadConfig(configDirectory);
            AnvilRecipeStore.reload();
            RPMODCommands.register();
            Executors.newSingleThreadScheduledExecutor(task -> {
                Thread thread = new Thread(task, "RPMOD-update-checker");
                thread.setDaemon(true);
                return thread;
            }).scheduleWithFixedDelay(
                RpProjectManager::checkForUpdates,
                5, 5, TimeUnit.MINUTES
            );
            LOGGER.info("RPMOD client initialized. Automatic project update checks every 5 minutes. Cache: {}", projectsDirectory);
        } catch (java.io.IOException exception) {
            LOGGER.error("Could not create RPMOD project cache directory", exception);
        }
    }
}
