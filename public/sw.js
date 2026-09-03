/* Service worker Djeli — stratégie minimale (§29).
 *
 *  - PRÉ-CACHE : la page /offline et les icônes (coquille de secours).
 *  - NAVIGATIONS (documents) : réseau d'abord ; hors ligne → /offline.
 *  - ASSETS statiques Next (/_next/static, icônes) : cache d'abord (immuables).
 *  - API / auth / server actions : JAMAIS interceptés (toujours réseau direct).
 *
 * Aucune donnée métier n'est mise en cache : les actions exigent une connexion
 * (l'idempotence serveur couvre les retours de réseau, §31).
 */
const VERSION = "djeli-sw-v1";
const SHELL = `${VERSION}-shell`;
const PRECACHE = [
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon.svg",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function isBypassed(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/register") ||
    url.pathname.startsWith("/invite") ||
    url.pathname.startsWith("/_next/data/")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isBypassed(url)) return;

  // Assets immuables → cache d'abord.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Navigations → réseau d'abord, repli /offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put("/__last_page", copy));
          return res;
        })
        .catch(async () => {
          const last = await caches.match("/__last_page");
          const offline = await caches.match("/offline");
          return last || offline || new Response("Hors ligne", { status: 503 });
        }),
    );
  }
});

// Web Push — prêt (§32, §33). Actif uniquement si un abonnement push existe.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Djeli", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Djeli";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || "djeli",
      data: { url: data.url || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(target);
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
