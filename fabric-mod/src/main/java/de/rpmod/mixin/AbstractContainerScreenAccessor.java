package de.rpmod.mixin;

import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

@Mixin(AbstractContainerScreen.class)
public interface AbstractContainerScreenAccessor {
    @Accessor("leftPos") int rpmod$getLeftPos();
    @Accessor("topPos") int rpmod$getTopPos();
    @Accessor("imageWidth") int rpmod$getImageWidth();
}
