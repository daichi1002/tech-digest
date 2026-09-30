// App shell and data are both network-first, so deploys show on the next launch without a version bump.
// VERSION only names the offline cache; bump it to drop old cached files.
// Cache names are shared by every project site on daichi1002.github.io, so they carry an app prefix.
const PREFIX = "tech-digest-";
const VERSION = "v5";
const SHELL = `${PREFIX}shell-${VERSION}`;
const DATA = `${PREFIX}data`;
// Unprefixed names used up to v2; removed once on upgrade.
const LEGACY = ["shell-v1", "shell-v2", "data"];
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
      .then((keys) => Promise.all(keys.filter((k) => (k.startsWith(`${PREFIX}shell-`) && k !== SHELL) || LEGACY.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first: always try the latest file; fall back to the cached copy when offline or when the
// network is slower than `timeoutMs` (a slow connection still gets a page; the fetch keeps updating the cache).
async function networkFirst(req, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  const network = fetch(req, { cache: "no-cache" }).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  network.catch(() => {}); // if we already answered from cache, a later network failure is not an error
  const cached = () => cache.match(req, { ignoreSearch: true });
  try {
    if (!timeoutMs) return await network;
    const slow = new Promise((resolve) => setTimeout(resolve, timeoutMs, "timeout"));
    const first = await Promise.race([network, slow]);
    if (first !== "timeout") return first;
    return (await cached()) || (await network);
  } catch {
    const hit = await cached();
    if (hit) return hit;
    throw new Error("offline and not cached");
  }
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || !e.request.url.startsWith(self.registration.scope)) return;
  const isData = url.pathname.includes("/data/") || url.pathname.endsWith("push-config.json");
  e.respondWith(isData ? networkFirst(e.request, DATA) : networkFirst(e.request, SHELL, 4000));
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
