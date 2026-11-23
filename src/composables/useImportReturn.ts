import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToursStore } from '@/stores/tours'

/** Parámetros del OAuth que se conservan para `GoogleConnectNotice`; el resto de la vuelta se quita. */
const OAUTH_NOTICE_KEYS = ['google_connect', 'purpose', 'reason']

/**
 * Ruta a la que vuelve "Conectar Google Sheets" desde el modal Importar (F4 §4.5): la actual con
 * `?import=sheets&tour=<uuid>` (la gira activa vive solo en memoria y se pierde con la redirección)
 * y sin restos de una vuelta anterior.
 */
export function sheetsReturnTo(fullPath: string, tourUuid: string): string {
  const url = new URL(fullPath, 'http://giras.local')
  for (const key of OAUTH_NOTICE_KEYS) url.searchParams.delete(key)
  url.searchParams.set('import', 'sheets')
  url.searchParams.set('tour', tourUuid)
  return `${url.pathname}${url.search}`
}

export interface ImportReturnOptions {
  /** El modal Importar ya se puede abrir (gira activa cargada, admin, fuera de la demo). */
  ready: () => boolean
  /** Abre el modal Importar en el formulario de la hoja. */
  onSheets: () => void
}

/**
 * Vuelta del OAuth de "Conectar Google Sheets" a una vista que monta `ImportDropModal`
 * (`?import=sheets&tour=<uuid>`): quita esos dos parámetros de la URL al montar, activa la gira de
 * la vuelta en cuanto la lista de giras está cargada y, cuando `ready()`, abre el formulario una
 * sola vez. Cualquier otro valor de `import` no se toca (lo gestiona la vista).
 */
export function useImportReturn(opts: ImportReturnOptions) {
  const route = useRoute()
  const router = useRouter()
  const toursStore = useToursStore()

  if (route.query.import !== 'sheets') return
  const tourUuid = typeof route.query.tour === 'string' && route.query.tour ? route.query.tour : null
  let pending = true
  void router.replace({ query: { ...route.query, import: undefined, tour: undefined } })

  const stop = watch(
    () => [toursStore.tours.length, toursStore.activeTour?.uuid, opts.ready()] as const,
    () => {
      if (!pending) return
      if (tourUuid && toursStore.activeTour?.uuid !== tourUuid) {
        // Hasta que la lista de giras llegue no se puede activar: se espera a la siguiente vuelta.
        if (!toursStore.setActiveTourByUuid(tourUuid)) return
      }
      if (!opts.ready()) return
      pending = false
      opts.onSheets()
      queueMicrotask(() => stop())
    },
    { immediate: true }
  )
}
