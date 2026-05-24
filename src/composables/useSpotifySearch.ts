import { useAuthStore } from '@/stores/auth'

export interface SpotifyArtist {
  id: string
  name: string
  external_urls: { spotify: string }
  images: { url: string; height: number; width: number }[]
  followers: { total: number }
  genres: string[]
}

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api'

// ─── Public API ───────────────────────────────────────────────────────────────

export async function searchSpotifyArtists(query: string): Promise<SpotifyArtist[]> {
  const auth = useAuthStore()
  const res = await auth.fetchWithAuth(
    `${API_BASE}/tours/spotify_search/?q=${encodeURIComponent(query)}`,
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `Error ${res.status}`)
  }
  return (await res.json()) as SpotifyArtist[]
}

export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return `${n}`
}
