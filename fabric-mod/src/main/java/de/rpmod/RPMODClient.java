package de.rpmod;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.loader.api.FabricLoader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.nio.file.Path;

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
            LOGGER.info("RPMOD client initialized. Project cache: {}", projectsDirectory);
        } catch (java.io.IOException exception) {
            LOGGER.error("Could not create RPMOD project cache directory", exception);
        }
    }
}
