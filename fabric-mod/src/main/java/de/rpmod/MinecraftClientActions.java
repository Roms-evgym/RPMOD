package de.rpmod;

import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.server.packs.repository.PackRepository;

import java.util.LinkedHashSet;
import java.util.Set;

final class MinecraftClientActions {
    private MinecraftClientActions() {}

    static void activate(String code) {
        Minecraft client = Minecraft.getInstance();
        client.execute(() -> {
            PackRepository repository = client.getResourcePackRepository();
            repository.reload();
            String id = "file/RPMOD_" + code + ".zip";
            if (!repository.isAvailable(id)) {
                if (client.player != null) client.player.sendSystemMessage(
                    Component.literal("RPMOD: ZIP wurde gespeichert, Minecraft hat das Pack aber nicht erkannt: " + id));
                return;
            }
            Set<String> selected = new LinkedHashSet<>(repository.getSelectedIds());
            selected.add(id);
            repository.setSelected(selected);
            client.options.updateResourcePacks(repository);
            if (client.player != null) client.player.sendSystemMessage(
                Component.literal("RPMOD: " + code + " wurde aktiviert. Ressourcen werden neu geladen."));
        });
    }

    static void deactivate(String code, Runnable afterReload) {
        Minecraft client = Minecraft.getInstance();
        client.execute(() -> {
            PackRepository repository = client.getResourcePackRepository();
            repository.reload();
            String id = "file/RPMOD_" + code + ".zip";
            Set<String> selected = new LinkedHashSet<>(repository.getSelectedIds());
            selected.remove(id);
            repository.setSelected(selected);
            client.options.resourcePacks.remove(id);
            client.options.incompatibleResourcePacks.remove(id);
            client.options.save();
            client.reloadResourcePacks().whenComplete((ignored, error) -> client.execute(() -> {
                if (error != null) RPMODClient.LOGGER.warn("Could not reload resources after leaving project {}", code, error);
                afterReload.run();
            }));
        });
    }
}
