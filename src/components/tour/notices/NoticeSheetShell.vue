<script setup lang="ts">
import AppModal from '@/components/ui/AppModal.vue'
import MobileDetailOverlay from '@/components/ui/MobileDetailOverlay.vue'
import { useIsMobile } from '@/composables/useIsMobile'

/**
 * Contenedor de las hojas de avisos: a pantalla completa en móvil (`MobileDetailOverlay`, donde
 * el tour manager aprueba) y modal en escritorio. El pie (`footer`) queda fijo abajo en móvil
 * para que "Enviar ahora" esté siempre a mano.
 */
defineProps<{ show: boolean; persistent?: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { isMobile } = useIsMobile()
</script>

<template>
  <MobileDetailOverlay
    v-if="isMobile"
    :show="show"
    @close="emit('close')"
  >
    <div class="flex-1 overflow-y-auto px-4 py-4">
      <slot />
    </div>
    <div
      v-if="$slots.footer"
      class="flex-shrink-0 border-t border-line bg-bg-3 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
    >
      <slot name="footer" />
    </div>
  </MobileDetailOverlay>
  <AppModal
    v-else
    :show="show"
    :persistent="persistent"
    @close="emit('close')"
  >
    <slot />
    <div
      v-if="$slots.footer"
      class="mt-4 pt-3 border-t border-line"
    >
      <slot name="footer" />
    </div>
  </AppModal>
</template>
