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
import net.minecraft.world.item.Items;

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
    private static final Set<AnvilScreen> OPEN = java.util.Collections.newSetFromMap(new WeakHashMap<>());
    private static final Set<String> COLLAPSED_CATEGORIES = new java.util.HashSet<>();
    private static final Map<AnvilScreen, String> SELECTED = new WeakHashMap<>();

    private AnvilSidebar() {}

    public static void initSearch(AnvilScreen screen) {
        AbstractContainerScreenAccessor accessor = (AbstractContainerScreenAccessor) screen;
        int x = panelX(screen) + 8;
        int y = accessor.rpmod$getTopPos() + 27;
        ((AnvilScreenAccessor) screen).rpmod$getName().setCanLoseFocus(true);
        EditBox box = new EditBox(screen.getFont(), x, y, PANEL_WIDTH - 16, 14, Component.literal("RPMOD Suche"));
        box.setMaxLength(48);
        box.setHint(Component.literal("Custom-Items suchen"));
        box.setVisible(false);
        ((ScreenAccessor) screen).rpmod$addRenderableWidget(box);
        SEARCH_BOXES.put(screen, box);
    }

    public static void renderSearch(AnvilScreen screen, GuiGraphicsExtractor graphics, int mouseX, int mouseY, float partialTick) {
        EditBox box = SEARCH_BOXES.get(screen);
        if (box != null && OPEN.contains(screen)) box.extractRenderState(graphics, mouseX, mouseY, partialTick);
    }

    public static void renderBookButton(AnvilScreen screen, GuiGraphicsExtractor graphics, int mouseX, int mouseY) {
        AbstractContainerScreenAccessor accessor = (AbstractContainerScreenAccessor) screen;
        int x = accessor.rpmod$getLeftPos() + 7;
        int y = accessor.rpmod$getTopPos() + 25;
        boolean open = OPEN.contains(screen);
        boolean hovered = mouseX >= x && mouseX < x + 18 && mouseY >= y && mouseY < y + 18;
        graphics.fill(x - 1, y - 1, x + 19, y + 19, open ? 0xFF557A43 : hovered ? 0xFF59677A : 0xFF292D36);
        graphics.outline(x - 1, y - 1, 20, 20, open ? 0xFF9DF36A : 0xFF8794A8);
        graphics.item(new ItemStack(Items.KNOWLEDGE_BOOK), x, y);
    }

    public static void render(AnvilScreen screen, GuiGraphicsExtractor graphics) {
        if (!OPEN.contains(screen)) return;
        List<AnvilRecipeStore.Recipe> recipes = filteredRecipes(screen);
        Map<String, List<AnvilRecipeStore.Recipe>> groups = new java.util.LinkedHashMap<>();
        for (AnvilRecipeStore.Recipe recipe : recipes) {
            groups.computeIfAbsent(recipe.shareCode(), ignored -> new java.util.ArrayList<>()).add(recipe);
        }
        AbstractContainerScreenAccessor accessor = (AbstractContainerScreenAccessor) screen;
        int x = panelX(screen);
        int y = accessor.rpmod$getTopPos();
        int height = Math.max(100, screen.height - y - 8);
        graphics.fill(x, y, x + PANEL_WIDTH, y + height, 0xF0111825);
        graphics.outline(x, y, PANEL_WIDTH, height, 0xFF52627A);
        graphics.fill(x + 1, y + 1, x + PANEL_WIDTH - 1, y + 21, 0xFF29394F);
        graphics.text(screen.getFont(), "RPMOD · CUSTOM-ITEMS", x + 7, y + 7, 0xFF9DF36A);
        graphics.text(screen.getFont(), recipes.size() + " Items", x + 7, y + 21, 0xFFB7C4D5);
        int rowY = y + 48;
        if (groups.isEmpty()) {
            graphics.text(screen.getFont(), "Keine Custom-Items", x + 8, rowY + 5, 0xFF9AA9BB);
            return;
        }
        for (Map.Entry<String, List<AnvilRecipeStore.Recipe>> entry : groups.entrySet()) {
            String project = entry.getKey();
            List<AnvilRecipeStore.Recipe> projectItems = entry.getValue();
            boolean collapsed = COLLAPSED_CATEGORIES.contains(project);
            graphics.fill(x + 4, rowY, x + PANEL_WIDTH - 4, rowY + 22, 0xFF35465C);
            graphics.text(screen.getFont(), collapsed ? "▶" : "▼", x + 9, rowY + 7, 0xFFFFFFFF);
            graphics.text(screen.getFont(), trim(screen, projectItems.get(0).projectName() + " (" + projectItems.size() + ")", PANEL_WIDTH - 36), x + 23, rowY + 7, 0xFFFFFFFF);
            rowY += 23;
            if (!collapsed) {
                for (AnvilRecipeStore.Recipe recipe : projectItems) {
                    if (rowY + 23 > y + height - 3) break;
                    boolean selected = (recipe.shareCode() + "/" + recipe.id()).equals(SELECTED.get(screen));
                    graphics.fill(x + 8, rowY, x + PANEL_WIDTH - 8, rowY + 22, selected ? 0xFF36543A : 0xFF202C3C);
                    ItemStack icon = createBaseStack(recipe.baseItem());
                    try {
                        icon.set(DataComponents.ITEM_MODEL, Identifier.parse("rpmod:" + recipe.shareCode().toLowerCase() + "/" + recipe.id()));
                    } catch (Exception ignored) {}
                    graphics.item(icon, x + 11, rowY + 3);
                    graphics.text(screen.getFont(), trim(screen, recipe.renameTrigger(), PANEL_WIDTH - 48), x + 33, rowY + 7,
                        selected ? 0xFF9DF36A : 0xFFE8EDF5);
                    rowY += 23;
                }
            }
        }
    }

    public static boolean handleClick(AnvilScreen screen, double mouseX, double mouseY) {
        AbstractContainerScreenAccessor accessor = (AbstractContainerScreenAccessor) screen;
        int bookX = accessor.rpmod$getLeftPos() + 7;
        int bookY = accessor.rpmod$getTopPos() + 25;
        if (mouseX >= bookX - 1 && mouseX < bookX + 19 && mouseY >= bookY - 1 && mouseY < bookY + 19) {
            boolean opening = !OPEN.contains(screen);
            if (opening) OPEN.add(screen); else OPEN.remove(screen);
            EditBox search = SEARCH_BOXES.get(screen);
            if (search != null) search.setVisible(opening);
            return true;
        }
        if (!OPEN.contains(screen)) return false;
        int x = panelX(screen);
        int y = accessor.rpmod$getTopPos();
        if (mouseX < x || mouseX >= x + PANEL_WIDTH || mouseY < y || mouseY >= screen.height) return false;
        if (mouseY >= y + 27 && mouseY <= y + 46) return false;
        List<AnvilRecipeStore.Recipe> recipes = filteredRecipes(screen);
        Map<String, List<AnvilRecipeStore.Recipe>> groups = new java.util.LinkedHashMap<>();
        for (AnvilRecipeStore.Recipe recipe : recipes) groups.computeIfAbsent(recipe.shareCode(), ignored -> new java.util.ArrayList<>()).add(recipe);
        int rowY = y + 48;
        for (Map.Entry<String, List<AnvilRecipeStore.Recipe>> entry : groups.entrySet()) {
            if (mouseY >= rowY && mouseY < rowY + 23) {
                if (!COLLAPSED_CATEGORIES.add(entry.getKey())) COLLAPSED_CATEGORIES.remove(entry.getKey());
                return true;
            }
            rowY += 23;
            if (!COLLAPSED_CATEGORIES.contains(entry.getKey())) {
                for (AnvilRecipeStore.Recipe recipe : entry.getValue()) {
                    if (mouseY >= rowY && mouseY < rowY + 23) {
                        SELECTED.put(screen, recipe.shareCode() + "/" + recipe.id());
                        autofill(screen, recipe);
                        return true;
                    }
                    rowY += 23;
                }
            }
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

    private static int panelX(AnvilScreen screen) {
        AbstractContainerScreenAccessor accessor = (AbstractContainerScreenAccessor) screen;
        int left = accessor.rpmod$getLeftPos();
        if (left - PANEL_WIDTH - 8 >= 4) return left - PANEL_WIDTH - 8;
        return Math.min(screen.width - PANEL_WIDTH - 4, left + accessor.rpmod$getImageWidth() + 8);
    }

    private static List<AnvilRecipeStore.Recipe> filteredRecipes(AnvilScreen screen) {
        EditBox box = SEARCH_BOXES.get(screen);
        String query = box == null ? "" : box.getValue().trim().toLowerCase();
        if (query.isEmpty()) return AnvilRecipeStore.getRecipes();
        return AnvilRecipeStore.getRecipes().stream().filter(recipe ->
            recipe.renameTrigger().toLowerCase().contains(query)
                || recipe.baseItemName().toLowerCase().contains(query)
                || recipe.id().toLowerCase().contains(query)
                || recipe.shareCode().toLowerCase().contains(query)
                || recipe.projectName().toLowerCase().contains(query)
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
