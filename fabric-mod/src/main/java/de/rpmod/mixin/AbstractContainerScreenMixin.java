package de.rpmod.mixin;

import de.rpmod.AnvilSidebar;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.client.gui.screens.inventory.AnvilScreen;
import net.minecraft.client.input.MouseButtonEvent;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(AbstractContainerScreen.class)
public abstract class AbstractContainerScreenMixin {
    @Inject(method = "extractContents", at = @At("TAIL"))
    private void rpmod$renderSearch(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float partialTick, org.spongepowered.asm.mixin.injection.callback.CallbackInfo ci) {
        if ((Object) this instanceof AnvilScreen screen) {
            AnvilSidebar.renderSearch(screen, graphics, mouseX, mouseY, partialTick);
        }
    }
    @Inject(method = "mouseClicked", at = @At("HEAD"), cancellable = true)
    private void rpmod$handleSidebarClick(MouseButtonEvent event, boolean doubleClick, CallbackInfoReturnable<Boolean> cir) {
        if ((Object) this instanceof AnvilScreen screen && event.button() == 0
            && AnvilSidebar.handleClick(screen, event.x(), event.y())) {
            cir.setReturnValue(true);
        }
    }
}
