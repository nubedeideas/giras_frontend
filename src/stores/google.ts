import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import {
  EMPTY_GOOGLE_STATUS,
  googleErrorMessage,
  googleIntegrationApi,
  type GooglePurpose,
  type GoogleStatus,
} from '@/composables/useGoogleIntegration'

/**
 * Estado de la conexión con Google compartido entre Ajustes, los modales de importación y el
 * asistente. La llamada a la API vive en `useGoogleIntegration`; aquí solo se guarda el resultado.
 */
export const useGoogleStore = defineStore('google', () => {
  const status = ref<GoogleStatus | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let inflight: Promise<void> | null = null
  // Usuario al que pertenece `status`: tras cerrar sesión y entrar con otro, se vuelve a pedir.
  let loadedFor: string | null = null

  const connected = computed(() => status.value?.connected ?? false)
  const calendarConnected = computed(() => status.value?.features.calendar ?? false)
  const contactsConnected = computed(() => status.value?.features.contacts ?? false)
  const sheetsConnected = computed(() => status.value?.features.sheets ?? false)

  /**
   * `true` solo si sabemos que falta el permiso (estado cargado y sin él). Si el estado no se ha
   * podido cargar, las pantallas siguen como antes y se apoyan en el 403 `google_scope_missing`.
   */
  function knownMissing(purpose: GooglePurpose): boolean {
    return status.value !== null && !status.value.features[purpose]
  }

  function setStatus(s: GoogleStatus) {
    status.value = s
    error.value = null
    loadedFor = useAuthStore().user?.uuid ?? null
  }

  async function load(force = false): Promise<void> {
    const auth = useAuthStore()
    if (auth.isDemoMode) {
      status.value = { ...EMPTY_GOOGLE_STATUS, features: { ...EMPTY_GOOGLE_STATUS.features } }
      loadedFor = 'demo-user'
      return
    }
    const uuid = auth.user?.uuid ?? null
    if (status.value && !force && loadedFor === uuid) return
    if (inflight) return inflight
    loading.value = true
    error.value = null
    inflight = (async () => {
      try {
        status.value = await googleIntegrationApi.getStatus()
        loadedFor = uuid
      } catch (e) {
        error.value = googleErrorMessage(e, 'googleIntegration.fallback.status')
      } finally {
        loading.value = false
        inflight = null
      }
    })()
    return inflight
  }

  function reset() {
    status.value = null
    error.value = null
    loadedFor = null
  }

  return {
    status,
    loading,
    error,
    connected,
    calendarConnected,
    contactsConnected,
    sheetsConnected,
    knownMissing,
    setStatus,
    load,
    reset,
  }
})
