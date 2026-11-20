package de.rpmod;

import com.mojang.brigadier.arguments.StringArgumentType;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandManager;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;

public final class RPMODCommands {
    private RPMODCommands() {}

    public static void register() {
        ClientCommandRegistrationCallback.EVENT.register((dispatcher, registryAccess) ->
            dispatcher.register(ClientCommandManager.literal("rp")
                .then(ClientCommandManager.literal("join")
                    .then(ClientCommandManager.argument("shareCode", StringArgumentType.word())
                        .executes(context -> {
                            String code = StringArgumentType.getString(context, "shareCode").toUpperCase();
                            context.getSource().sendFeedback(Component.literal("RPMOD: Lade Projekt " + code + " ..."));
                            RpProjectManager.join(code, RPMODCommands::message);
                            return 1;
                        })))
                .then(ClientCommandManager.literal("sync")
                    .executes(context -> {
                        context.getSource().sendFeedback(Component.literal("RPMOD: Synchronisiere deine Projekte ..."));
                        RpProjectManager.syncAll(RPMODCommands::message);
                        return 1;
                    }))
                .then(ClientCommandManager.literal("leave")
                    .then(ClientCommandManager.argument("shareCode", StringArgumentType.word())
                        .executes(context -> {
                            String code = StringArgumentType.getString(context, "shareCode").toUpperCase();
                            context.getSource().sendFeedback(Component.literal("RPMOD: Entferne Projekt " + code + " ..."));
                            RpProjectManager.leave(code, RPMODCommands::message);
                            return 1;
                        })))
                .then(ClientCommandManager.literal("help")
                    .executes(context -> {
                        context.getSource().sendFeedback(Component.literal("RPMOD Befehle: /rp join <CODE>, /rp sync, /rp leave <CODE>"));
                        return 1;
                    }))
            )
        );
    }

    private static void message(String text) {
        Minecraft.getInstance().execute(() -> {
            if (Minecraft.getInstance().player != null) {
                Minecraft.getInstance().player.displayClientMessage(Component.literal(text), false);
            }
        });
    }
}
