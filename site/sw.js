// Bump when app shell files change so installed apps pick up the new version.
const VERSION = "v2";
const SHELL = `shell-${VERSION}`;
const DATA = "data";
const SHELL_FILES = [
  "./",
  "index.html",
  "app.js",
  "style.css",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("shell-") && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Data: network first so new digests show up immediately; cached copy when offline.
async function networkFirst(req) {
  const cache = await caches.open(DATA);
  try {
    const res = await fetch(req, { cache: "no-cache" });
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw new Error("offline and not cached");
  }
}

// Shell: serve from cache, refresh in the background.
async function staleWhileRevalidate(req) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(req, { ignoreSearch: true });
  const fresh = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || fresh;
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  const isData = url.pathname.includes("/data/") || url.pathname.endsWith("push-config.json");
  e.respondWith(isData ? networkFirst(e.request) : staleWhileRevalidate(e.request));
});

self.addEventListener("push", (e) => {
  let msg = { title: "Tech Digest", body: "今日のダイジェストが届きました", url: "./" };
  try { msg = { ...msg, ...e.data.json() }; } catch {}
  e.waitUntil(self.registration.showNotification(msg.title, {
    body: msg.body,
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    data: { url: msg.url },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || "./", self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const win = wins.find((w) => w.url.startsWith(self.registration.scope));
    if (win) { await win.focus(); return win.navigate(target); }
    return self.clients.openWindow(target);
  })());
});
