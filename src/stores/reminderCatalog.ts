import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError } from '@/utils/apiClient'
import { useReminderSettings, type ReminderCatalog } from '@/composables/useReminderSettings'

/**
 * Catálogo de recordatorios por tipo de la gira activa, compartido por el calendario (chips
 * "notificables") y el dashboard. La llamada la hace `useReminderSettings`; el endpoint es
 * solo para admins: un 403 deja `forbidden = true` sin error y `notifiableCodes` vacío.
 */
export const useReminderCatalogStore = defineStore('reminderCatalog', () => {
  const api = useReminderSettings()

  const catalog = ref<ReminderCatalog | null>(null)
  const tourUuid = ref<string | null>(null)
  const forbidden = ref(false)
  const loading = ref(false)
  const error = ref<unknown>(null)

  let request = 0

  /** Códigos de tipo con recordatorios efectivos (o sustituidos por una regla legada). */
  const notifiableCodes = computed(
    () =>
      new Set(
        (catalog.value?.types ?? [])
          .filter((t) => t.effective_steps.length > 0 || t.replaced_by_legacy_rule)
          .map((t) => t.activity_type_code)
      )
  )

  async function load(uuid: string, { force = false }: { force?: boolean } = {}): Promise<void> {
    if (!force && tourUuid.value === uuid && (catalog.value || forbidden.value || loading.value)) {
      return
    }
    const current = ++request
    if (tourUuid.value !== uuid) {
      catalog.value = null
      forbidden.value = false
    }
    tourUuid.value = uuid
    loading.value = true
    error.value = null
    try {
      const data = await api.getCatalog(uuid)
      if (current !== request) return
      catalog.value = data
      forbidden.value = false
    } catch (e) {
      if (current !== request) return
      catalog.value = null
      if (e instanceof ApiError && e.status === 403) {
        forbidden.value = true
      } else {
        error.value = e
      }
    } finally {
      if (current === request) loading.value = false
    }
  }

  /**
   * Tras cambiar recordatorios, grupos o reglas que afectan a "notificable". Con `uuid` de la
   * gira cargada se recarga ya (el calendario/dashboard montados se actualizan); sin `uuid`
   * (cambios de plantilla del usuario, afectan a todas las giras) se vacía y la siguiente vista
   * que lo necesite lo vuelve a pedir.
   */
  function invalidate(uuid?: string): Promise<void> {
    if (uuid && tourUuid.value === uuid) return load(uuid, { force: true })
    if (!uuid || tourUuid.value !== null) reset()
    return Promise.resolve()
  }

  function reset(): void {
    request++
    catalog.value = null
    tourUuid.value = null
    forbidden.value = false
    loading.value = false
    error.value = null
  }

  return { catalog, tourUuid, forbidden, loading, error, notifiableCodes, load, invalidate, reset }
})
