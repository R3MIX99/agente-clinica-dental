// Service worker: instalabilidad de la PWA + soporte offline para /citas.
//
// Estrategias:
// - Navegacion a /citas: network-first, con fallback a la ultima copia
//   cacheada si no hay red. Esto es lo que permite ver las citas ya
//   cargadas sin internet, sin importar cuando se abrio la app.
// - Navegacion a cualquier otra ruta: si falla la red, se sirve /offline
//   en vez del error generico del navegador.
// - /_next/static/*: stale-while-revalidate (contenido con hash, seguro de
//   cachear agresivamente) — necesario para que el bundle de la app cargue
//   offline sin depender solo de la cache HTTP del navegador.
// - /branding/*, /icon.png, /apple-icon.png: igual, stale-while-revalidate —
//   son los logos/iconos de la marca (sidebar, headers, login, /offline);
//   sin esto no se ven sin conexion aunque el resto de la pagina cargue.
// - Todo lo demas (llamadas a Supabase, APIs) pasa directo a la red, sin
//   cache — no se guardan datos de otras pestañas.

const CACHE_VERSION = "v3"
const CACHE_PAGES = `dentai-pages-${CACHE_VERSION}`
const CACHE_STATIC = `dentai-static-${CACHE_VERSION}`
const OFFLINE_URL = "/offline"
const BRANDING_PRECACHE = [
  "/branding/dentai-icon.png",
  "/branding/dentai-logo.png",
  "/branding/dentai-logo-white.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_PAGES).then((cache) => cache.add(OFFLINE_URL)),
      caches.open(CACHE_STATIC).then((cache) => cache.addAll(BRANDING_PRECACHE)),
    ])
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys()
      await Promise.all(
        nombres
          .filter((n) => n !== CACHE_PAGES && n !== CACHE_STATIC)
          .map((n) => caches.delete(n))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navegaciones (documentos HTML)
  if (request.mode === "navigate") {
    const esCitas = url.pathname === "/citas" || url.pathname.startsWith("/citas/")
    event.respondWith(manejarNavegacion(request, esCitas))
    return
  }

  // Assets estaticos con hash — seguros de cachear indefinidamente
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  // Logos/iconos de marca — cambian poco, pero no tienen hash en el nombre
  if (
    url.pathname.startsWith("/branding/") ||
    url.pathname === "/icon.png" ||
    url.pathname === "/apple-icon.png"
  ) {
    event.respondWith(staleWhileRevalidate(request))
    return
  }
})

async function manejarNavegacion(request, esCitas) {
  try {
    const respuesta = await fetch(request)
    if (esCitas && respuesta.ok) {
      const cache = await caches.open(CACHE_PAGES)
      cache.put(request, respuesta.clone())
    }
    return respuesta
  } catch {
    if (esCitas) {
      const cache = await caches.open(CACHE_PAGES)
      const cacheada = await cache.match(request)
      if (cacheada) return cacheada
    }
    const cache = await caches.open(CACHE_PAGES)
    const offline = await cache.match(OFFLINE_URL)
    if (offline) return offline
    return Response.error()
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_STATIC)
  const cacheada = await cache.match(request)

  const actualizar = fetch(request)
    .then((respuesta) => {
      if (respuesta.ok) cache.put(request, respuesta.clone())
      return respuesta
    })
    .catch(() => null)

  if (cacheada) return cacheada
  const red = await actualizar
  return red ?? Response.error()
}
