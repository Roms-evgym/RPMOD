package de.rpmod;

import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.server.packs.repository.PackRepository;

import java.util.LinkedHashSet;
import java.util.Set;

final class MinecraftClientActions {
    private MinecraftClientActions() {}

    static void activateCombined(String fileName) {
        Minecraft client = Minecraft.getInstance();
        client.execute(() -> {
            PackRepository repository = client.getResourcePackRepository();
            repository.reload();
            String id = "file/" + fileName;
            if (!repository.isAvailable(id)) {
                if (client.player != null) client.player.sendSystemMessage(
                    Component.literal("RPMOD: Das zusammengeführte Pack wurde nicht erkannt: " + fileName));
                return;
            }
            Set<String> selected = new LinkedHashSet<>(repository.getSelectedIds());
            selected.removeIf(value -> value.startsWith("file/RPMOD_"));
            selected.add(id);
            repository.setSelected(selected);
            client.options.updateResourcePacks(repository);
            client.reloadResourcePacks().whenComplete((ignored, error) -> client.execute(() -> {
                if (error != null) RPMODClient.LOGGER.warn("Could not reload combined RPMOD resource pack", error);
                if (client.player != null) client.player.sendSystemMessage(
                    Component.literal("RPMOD: " + fileName + " aktiviert – alle Projekt-Items sind bereit."));
            }));
        });
    }

    static void deactivateCombined(Runnable afterReload) {
        Minecraft client = Minecraft.getInstance();
        client.execute(() -> {
            PackRepository repository = client.getResourcePackRepository();
            repository.reload();
            Set<String> selected = new LinkedHashSet<>(repository.getSelectedIds());
            selected.removeIf(value -> value.startsWith("file/RPMOD_"));
            repository.setSelected(selected);
            client.options.resourcePacks.removeIf(value -> value.startsWith("file/RPMOD_"));
            client.options.incompatibleResourcePacks.removeIf(value -> value.startsWith("file/RPMOD_"));
            client.options.save();
            client.reloadResourcePacks().whenComplete((ignored, error) -> client.execute(() -> {
                if (error != null) RPMODClient.LOGGER.warn("Could not deactivate combined RPMOD pack", error);
                afterReload.run();
            }));
        });
    }
}
