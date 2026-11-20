import { apiClient } from '@/utils/apiClient'

export interface SpotifyArtist {
  id: string
  name: string
  external_urls: { spotify: string }
  images: { url: string; height: number; width: number }[]
  followers: { total: number }
  genres: string[]
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function searchSpotifyArtists(query: string): Promise<SpotifyArtist[]> {
  return apiClient.get<SpotifyArtist[]>(
    `/tours/spotify_search/?q=${encodeURIComponent(query)}`,
    { fallback: 'Error al buscar artistas en Spotify' }
  )
}

export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return `${n}`
}
