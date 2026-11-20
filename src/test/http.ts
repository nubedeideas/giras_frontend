import { vi } from 'vitest'

/** Respuesta JSON como la que devolvería la API. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Sustituye `fetch` por un mock que devuelve las respuestas en orden. */
export function mockFetch(...responses: Response[]) {
  const fn = vi.fn<typeof fetch>()
  for (const r of responses) fn.mockResolvedValueOnce(r)
  vi.stubGlobal('fetch', fn)
  return fn
}

/** URL y headers de la llamada n-ésima a un `fetch` mockeado. */
export function callAt(fn: ReturnType<typeof mockFetch>, n: number) {
  const [url, init] = fn.mock.calls[n]
  return { url: String(url), init: init ?? {}, headers: (init?.headers ?? {}) as Record<string, string> }
}
