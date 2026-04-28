export interface SpotifyArtist {
  id: string
  name: string
  external_urls: { spotify: string }
  images: { url: string; height: number; width: number }[]
  followers: { total: number }
  genres: string[]
}

// ─── Token cache (module-level, persists across uses) ─────────────────────────

let cachedToken: string | null = null
let tokenExpiry = 0

async function fetchToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string
  const clientSecret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET as string
  if (!clientId || !clientSecret) throw new Error('Spotify credentials not configured')

  // Credentials in body (not Authorization header) avoids CORS preflight
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`Spotify auth error: ${res.status}`)

  const data = await res.json()
  cachedToken = data.access_token as string
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function searchSpotifyArtists(query: string): Promise<SpotifyArtist[]> {
  const token = await fetchToken()
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=6`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`Spotify search error: ${res.status}`)
  const data = await res.json()
  return (data.artists?.items ?? []) as SpotifyArtist[]
}

export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return `${n}`
}
