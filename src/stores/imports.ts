import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Señal compartida de borradores de importación (F3). Suscribir un calendario o sincronizarlo
 * puede dejar un job `ready` desde fuera de Mi Gira (el modal de Mis giras, Ajustes ›
 * Calendarios): quien pinta el aviso de borradores pendientes (`TourView`) vigila `version` y
 * recarga su lista.
 */
export const useImportsStore = defineStore('imports', () => {
  /** Sube cada vez que puede haber cambiado la lista de borradores de alguna gira. */
  const version = ref(0)
  /** uuid de la gira afectada en el último cambio (`null` si no se sabe). */
  const lastTour = ref<string | null>(null)

  function invalidate(tourUuid: string | null = null) {
    lastTour.value = tourUuid
    version.value++
  }

  return { version, lastTour, invalidate }
})
