package de.rpmod;

import net.minecraft.client.Minecraft;
import de.rpmod.mixin.AnvilScreenAccessor;
import de.rpmod.mixin.AbstractContainerScreenAccessor;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.inventory.AnvilScreen;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.component.DataComponents;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AnvilMenu;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;

import java.util.List;

public final class AnvilSidebar {
    private static final int PANEL_WIDTH = 142;
    private static final int ROW_HEIGHT = 34;
    private static final int FIRST_ROW_Y = 29;
    private static final int VISIBLE_ROWS = 4;

    private AnvilSidebar() {}

    public static void render(AnvilScreen screen, GuiGraphicsExtractor graphics) {
        List<AnvilRecipeStore.Recipe> recipes = AnvilRecipeStore.getRecipes();
        if (recipes.isEmpty()) return;

        int x = localPanelX(screen);
        int rows = Math.min(VISIBLE_ROWS, recipes.size());
        int height = FIRST_ROW_Y + rows * ROW_HEIGHT + 8;
        graphics.fill(x, 0, x + PANEL_WIDTH, height, 0xE8111A29);
        graphics.outline(x, 0, PANEL_WIDTH, height, 0xFF40536D);
        graphics.text(screen.getFont(), "RPMOD · ITEMS", x + 8, 7, 0xFF9DF36A);
        graphics.text(screen.getFont(), recipes.size() + " Rezept(e)", x + 8, 18, 0xFF93A4BB);

        for (int i = 0; i < rows; i++) {
            AnvilRecipeStore.Recipe recipe = recipes.get(i);
            int rowY = FIRST_ROW_Y + i * ROW_HEIGHT;
            graphics.fill(x + 5, rowY, x + PANEL_WIDTH - 5, rowY + ROW_HEIGHT - 2, 0xFF1B293B);
            ItemStack base = createBaseStack(recipe.baseItem());
            ItemStack result = base.copy();
            try {
                result.set(DataComponents.ITEM_MODEL, Identifier.parse("rpmod:" + recipe.shareCode().toLowerCase() + "/" + recipe.id()));
            } catch (Exception ignored) {}
            graphics.item(base, x + 8, rowY + 7);
            graphics.text(screen.getFont(), "→", x + 29, rowY + 10, 0xFF9DF36A);
            graphics.item(result, x + 43, rowY + 7);
            graphics.text(screen.getFont(), trim(screen, recipe.renameTrigger(), 62), x + 66, rowY + 5, 0xFFFFFFFF);
            graphics.text(screen.getFont(), trim(screen, recipe.baseItemName(), 62), x + 66, rowY + 18, 0xFF91A2B9);
        }

        if (recipes.size() > VISIBLE_ROWS) {
            graphics.text(screen.getFont(), "Nutze /rp sync für Updates", x + 8, height - 12, 0xFF91A2B9);
        }
    }

    public static boolean handleClick(AnvilScreen screen, double mouseX, double mouseY) {
        List<AnvilRecipeStore.Recipe> recipes = AnvilRecipeStore.getRecipes();
        if (recipes.isEmpty()) return false;
        AbstractContainerScreenAccessor accessor = (AbstractContainerScreenAccessor) screen;
        int x = accessor.rpmod$getLeftPos() + localPanelX(screen);
        int y = accessor.rpmod$getTopPos();
        int rows = Math.min(VISIBLE_ROWS, recipes.size());
        int height = FIRST_ROW_Y + rows * ROW_HEIGHT + 8;
        if (mouseX < x || mouseX >= x + PANEL_WIDTH || mouseY < y || mouseY >= y + height) return false;
        int row = (int) ((mouseY - y - FIRST_ROW_Y) / ROW_HEIGHT);
        if (row >= 0 && row < rows) autofill(screen, recipes.get(row));
        return true;
    }

    private static void autofill(AnvilScreen screen, AnvilRecipeStore.Recipe recipe) {
        Minecraft client = Minecraft.getInstance();
        Player player = client.player;
        AnvilMenu menu = screen.getMenu();
        if (player == null || client.gameMode == null) return;
        if (menu.getSlot(0).hasItem()) {
            player.sendSystemMessage(Component.literal("RPMOD: Leere zuerst den linken Amboss-Slot."));
            return;
        }
        if (!menu.getCarried().isEmpty()) {
            player.sendSystemMessage(Component.literal("RPMOD: Lege zuerst den Gegenstand aus deiner Maus ab."));
            return;
        }

        Item baseItem;
        try {
            baseItem = BuiltInRegistries.ITEM.get(Identifier.parse(recipe.baseItem())).map(reference -> reference.value()).orElse(net.minecraft.world.item.Items.AIR);
        } catch (Exception exception) {
            player.sendSystemMessage(Component.literal("RPMOD: Ungültiges Basis-Item: " + recipe.baseItem()));
            return;
        }
        if (baseItem == null || baseItem == net.minecraft.world.item.Items.AIR) {
            player.sendSystemMessage(Component.literal("RPMOD: Basis-Item nicht gefunden: " + recipe.baseItem()));
            return;
        }

        int inventoryMenuSlot = -1;
        for (int i = 3; i < menu.slots.size(); i++) {
            Slot slot = menu.getSlot(i);
            if (!slot.getItem().isEmpty() && slot.getItem().is(baseItem)) {
                inventoryMenuSlot = i;
                break;
            }
        }
        if (inventoryMenuSlot < 0) {
            player.sendSystemMessage(Component.literal("RPMOD: Du benötigst " + recipe.baseItemName() + " im Inventar."));
            return;
        }

        client.gameMode.handleContainerInput(menu.containerId, inventoryMenuSlot, 0, ContainerInput.PICKUP, player);
        client.gameMode.handleContainerInput(menu.containerId, 0, 1, ContainerInput.PICKUP, player);
        if (!menu.getCarried().isEmpty()) {
            client.gameMode.handleContainerInput(menu.containerId, inventoryMenuSlot, 0, ContainerInput.PICKUP, player);
        }
        ((AnvilScreenAccessor) screen).rpmod$getName().setValue(recipe.renameTrigger());
        player.sendSystemMessage(Component.literal("RPMOD: " + recipe.renameTrigger() + " vorbereitet."));
    }

    private static ItemStack createBaseStack(String itemId) {
        try {
            Item item = BuiltInRegistries.ITEM.get(Identifier.parse(itemId)).map(reference -> reference.value()).orElse(net.minecraft.world.item.Items.AIR);
            return new ItemStack(item);
        } catch (Exception ignored) {
            return ItemStack.EMPTY;
        }
    }

    private static int localPanelX(AnvilScreen screen) {
        AbstractContainerScreenAccessor accessor = (AbstractContainerScreenAccessor) screen;
        int right = accessor.rpmod$getImageWidth() + 8;
        if (accessor.rpmod$getLeftPos() + right + PANEL_WIDTH > screen.width - 4) return -PANEL_WIDTH - 8;
        return right;
    }

    private static String trim(AnvilScreen screen, String value, int maxWidth) {
        if (screen.getFont().width(value) <= maxWidth) return value;
        String result = value;
        while (!result.isEmpty() && screen.getFont().width(result + "…") > maxWidth) {
            result = result.substring(0, result.length() - 1);
        }
        return result + "…";
    }
}
