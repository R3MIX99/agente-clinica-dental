// Service worker minimo: solo existe para que Chrome/Android considere la
// app instalable ("Add to Home Screen" -> Instalar en vez de solo Acceso
// directo). No cachea nada ni intercepta peticiones — deja pasar todo tal
// cual a la red.
self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", () => {
  // passthrough — sin cache, sin logica offline
})
