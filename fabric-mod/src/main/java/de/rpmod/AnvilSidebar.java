package de.rpmod;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.components.EditBox;
import de.rpmod.mixin.AnvilScreenAccessor;
import de.rpmod.mixin.AbstractContainerScreenAccessor;
import de.rpmod.mixin.ScreenAccessor;
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
import java.util.Map;
import java.util.Set;
import java.util.WeakHashMap;

public final class AnvilSidebar {
    private static final int PANEL_WIDTH = 142;
    private static final int ROW_HEIGHT = 34;
    private static final int FIRST_ROW_Y = 50;
    private static final Map<AnvilScreen, EditBox> SEARCH_BOXES = new WeakHashMap<>();
    private static final int VISIBLE_ROWS = 4;
    private static final Set<AnvilScreen> COLLAPSED = java.util.Collections.newSetFromMap(new WeakHashMap<>());
    private static final Map<AnvilScreen, String> SELECTED = new WeakHashMap<>();

    private AnvilSidebar() {}

    public static void initSearch(AnvilScreen screen) {
        AbstractContainerScreenAccessor accessor = (AbstractContainerScreenAccessor) screen;
        int x = accessor.rpmod$getLeftPos() + localPanelX(screen) + 8;
        int y = accessor.rpmod$getTopPos() + 30;
        ((AnvilScreenAccessor) screen).rpmod$getName().setCanLoseFocus(true);
        EditBox box = new EditBox(screen.getFont(), x, y, PANEL_WIDTH - 16, 14, Component.literal("RPMOD Suche"));
        box.setMaxLength(48);
        ((ScreenAccessor) screen).rpmod$addRenderableWidget(box);
        SEARCH_BOXES.put(screen, box);
    }

    public static void renderSearch(AnvilScreen screen, GuiGraphicsExtractor graphics, int mouseX, int mouseY, float partialTick) {
        EditBox box = SEARCH_BOXES.get(screen);
        if (box != null) box.extractRenderState(graphics, mouseX, mouseY, partialTick);
    }

    public static void render(AnvilScreen screen, GuiGraphicsExtractor graphics) {
        List<AnvilRecipeStore.Recipe> recipes = filteredRecipes(screen);

        int x = localPanelX(screen);
        boolean collapsed = COLLAPSED.contains(screen);
        int rows = Math.min(VISIBLE_ROWS, recipes.size());
        int height = collapsed ? 26 : FIRST_ROW_Y + rows * ROW_HEIGHT + 8;
        graphics.fill(x, 0, x + PANEL_WIDTH, height, 0xE8111A29);
        graphics.outline(x, 0, PANEL_WIDTH, height, 0xFF40536D);
        graphics.text(screen.getFont(), collapsed ? "▶ RPMOD · ITEMS" : "▼ RPMOD · ITEMS", x + 8, 7, 0xFF9DF36A);
        if (collapsed) return;
        graphics.text(screen.getFont(), recipes.size() + " Treffer", x + 8, 18, 0xFF93A4BB);
        if (recipes.isEmpty()) {
            graphics.text(screen.getFont(), "Keine Items gefunden", x + 8, 53, 0xFF91A2B9);
            return;
        }

        for (int i = 0; i < rows; i++) {
            AnvilRecipeStore.Recipe recipe = recipes.get(i);
            int rowY = FIRST_ROW_Y + i * ROW_HEIGHT;
            boolean selected = (recipe.shareCode() + "/" + recipe.id()).equals(SELECTED.get(screen));
            graphics.fill(x + 5, rowY, x + PANEL_WIDTH - 5, rowY + ROW_HEIGHT - 2, selected ? 0xFF36543A : 0xFF1B293B);
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
        List<AnvilRecipeStore.Recipe> recipes = filteredRecipes(screen);
        if (AnvilRecipeStore.getRecipes().isEmpty()) return false;
        AbstractContainerScreenAccessor accessor = (AbstractContainerScreenAccessor) screen;
        int x = accessor.rpmod$getLeftPos() + localPanelX(screen);
        int y = accessor.rpmod$getTopPos();
        boolean collapsed = COLLAPSED.contains(screen);
        int rows = Math.min(VISIBLE_ROWS, recipes.size());
        int height = collapsed ? 26 : FIRST_ROW_Y + rows * ROW_HEIGHT + 8;
        if (mouseX < x || mouseX >= x + PANEL_WIDTH || mouseY < y || mouseY >= y + height) return false;
        if (mouseY <= y + 26) {
            if (collapsed) COLLAPSED.remove(screen); else COLLAPSED.add(screen);
            return true;
        }
        if (collapsed) return true;
        if (mouseX >= x + 8 && mouseX <= x + PANEL_WIDTH - 8 && mouseY >= y + 30 && mouseY <= y + 46) return false;
        int row = (int) ((mouseY - y - FIRST_ROW_Y) / ROW_HEIGHT);
        if (row >= 0 && row < rows) {
            AnvilRecipeStore.Recipe selected = recipes.get(row);
            SELECTED.put(screen, selected.shareCode() + "/" + selected.id());
            autofill(screen, selected);
        }
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
        int left = accessor.rpmod$getLeftPos();
        int right = accessor.rpmod$getImageWidth() + 8;
        if (left + right + PANEL_WIDTH > screen.width - 4) return Math.max(6, left - PANEL_WIDTH - 8) - left;
        return right;
    }

    private static List<AnvilRecipeStore.Recipe> filteredRecipes(AnvilScreen screen) {
        EditBox box = SEARCH_BOXES.get(screen);
        String query = box == null ? "" : box.getValue().trim().toLowerCase();
        if (query.isEmpty()) return AnvilRecipeStore.getRecipes();
        return AnvilRecipeStore.getRecipes().stream().filter(recipe ->
            recipe.renameTrigger().toLowerCase().contains(query)
                || recipe.baseItemName().toLowerCase().contains(query)
                || recipe.id().toLowerCase().contains(query)
        ).toList();
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
