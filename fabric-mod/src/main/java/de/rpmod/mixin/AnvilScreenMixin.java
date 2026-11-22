package de.rpmod.mixin;

import de.rpmod.AnvilSidebar;
import net.minecraft.client.gui.screens.inventory.AnvilScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(AnvilScreen.class)
public abstract class AnvilScreenMixin {
    @Inject(method = "subInit", at = @At("TAIL"))
    private void rpmod$initSearch(CallbackInfo ci) {
        AnvilSidebar.initSearch((AnvilScreen) (Object) this);
    }
}
