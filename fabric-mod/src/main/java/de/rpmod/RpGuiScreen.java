package de.rpmod;

import net.minecraft.Util;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

import java.net.URI;

public final class RpGuiScreen extends Screen {
    private EditBox projectName;
    private EditBox shareCode;
    private String status = "Erstelle ein neues Resource Pack oder öffne ein bestehendes.";
    private String createdCode = "";
    private String editToken = "";

    public RpGuiScreen() {
        super(Component.literal("RPMOD"));
    }

    @Override
    protected void init() {
        int center = this.width / 2;
        int top = Math.max(36, this.height / 2 - 112);

        projectName = new EditBox(this.font, center - 125, top, 250, 20, Component.literal("Projektname"));
        projectName.setMaxLength(80);
        projectName.setValue("Mein Resource Pack");
        addRenderableWidget(projectName);

        addRenderableWidget(Button.builder(Component.literal("Neues RP erstellen"), button -> createProject())
            .bounds(center - 125, top + 28, 250, 20).build());

        shareCode = new EditBox(this.font, center - 125, top + 62, 250, 20, Component.literal("Share-Code"));
        shareCode.setMaxLength(10);
        shareCode.setHint(Component.literal("RPM-A1B2C3"));
        addRenderableWidget(shareCode);

        addRenderableWidget(Button.builder(Component.literal("Projekt beitreten"), button -> {
            String code = shareCode.getValue().trim().toUpperCase();
            status = "Lade Projekt " + code + " ...";
            RpProjectManager.join(code, this::setStatus);
        }).bounds(center - 125, top + 88, 250, 20).build());

        addRenderableWidget(Button.builder(Component.literal("Web-Editor öffnen"), button -> openWeb())
            .bounds(center - 125, top + 120, 250, 20).build());

        addRenderableWidget(Button.builder(Component.literal("Alle Projekte synchronisieren"), button -> {
            status = "Synchronisiere Projekte ...";
            RpProjectManager.syncAll(this::setStatus);
        }).bounds(center - 125, top + 146, 250, 20).build());

        addRenderableWidget(Button.builder(Component.literal("Edit-Token kopieren"), button -> {
            if (editToken.isBlank()) {
                status = "Erstelle zuerst ein neues RP.";
            } else {
                Minecraft.getInstance().keyboardHandler.setClipboard(editToken);
                status = "Edit-Token wurde in die Zwischenablage kopiert.";
            }
        }).bounds(center - 125, top + 172, 250, 20).build());

        addRenderableWidget(Button.builder(Component.literal("Schließen"), button -> onClose())
            .bounds(center - 125, top + 202, 250, 20).build());
    }

    private void createProject() {
        String name = projectName.getValue().trim();
        if (name.isEmpty()) {
            status = "Bitte gib einen Projektnamen ein.";
            return;
        }
        status = "Erstelle dein Resource Pack in der Cloud ...";
        RpProjectManager.createProject(name, created -> Minecraft.getInstance().execute(() -> {
            createdCode = created.shareCode();
            editToken = created.editToken();
            shareCode.setValue(createdCode);
            status = "RP erstellt! Code: " + createdCode + " | Edit-Token ist bereit.";
        }), error -> setStatus("Projekt konnte nicht erstellt werden: " + error));
    }

    private void openWeb() {
        String url = RpProjectManager.getWebEditorUrl();
        if (!createdCode.isBlank()) url += "?code=" + createdCode;
        Util.getPlatform().openUri(URI.create(url));
        status = "Web-Editor wurde im Browser geöffnet.";
    }

    private void setStatus(String value) {
        Minecraft.getInstance().execute(() -> status = value);
    }

    @Override
    protected void extractRenderState(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float partialTick) {
        super.extractRenderState(graphics, mouseX, mouseY, partialTick);
        graphics.centeredText(this.font, "RPMOD · RESOURCE PACK STUDIO", this.width / 2, 18, 0xFF9DF36A);
        graphics.centeredText(this.font, status, this.width / 2, this.height - 30, 0xFFFFFFFF);
    }
}
