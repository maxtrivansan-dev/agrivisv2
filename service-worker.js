/* ===========================================
   SERVICE WORKER — Hidroponik Melon PWA
   =========================================== */

const CACHE_NAME = "hidromelon-v1";
const STATIC_CACHE = "hidromelon-static-v1";
const DYNAMIC_CACHE = "hidromelon-dynamic-v1";

/* Aset statis yang di-cache saat install */
const STATIC_ASSETS = [
  "/agrivisv2/",
  "/agrivisv2/index.html",
  "/agrivisv2/style.css",
  "/agrivisv2/script.js",
  "/agrivisv2/manifest.json",
  "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.29.0/dist/tabler-icons.min.css",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js",
];

/* =====================
   INSTALL — Pre-cache aset statis
   ===================== */
self.addEventListener("install", (event) => {
  console.log("[SW] Installing Hidroponik Melon PWA...");
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log("[SW] Pre-caching static assets");
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn(
          "[SW] Pre-cache partial failure (CDN assets may require network):",
          err,
        );
        return self.skipWaiting();
      }),
  );
});

/* =====================
   ACTIVATE — Hapus cache lama
   ===================== */
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating new service worker...");
  event.waitUntil(
    caches
      .keys()
      .then((keyList) => {
        return Promise.all(
          keyList.map((key) => {
            if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE) {
              console.log("[SW] Removing old cache:", key);
              return caches.delete(key);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

/* =====================
   FETCH — Strategi cache
   ===================== */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* --- Firebase Realtime DB: Network-first, fallback ke cache --- */
  if (url.hostname.includes("firebasedatabase.app")) {
    event.respondWith(networkFirst(request));
    return;
  }

  /* --- Roboflow API: Network-only (tidak di-cache, data gambar besar) --- */
  if (url.hostname.includes("roboflow.com")) {
    event.respondWith(fetch(request).catch(() => offlineResponse("api")));
    return;
  }

  /* --- CDN (Tabler Icons, Chart.js): Cache-first --- */
  if (url.hostname.includes("jsdelivr.net") || url.hostname.includes("cdn.")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  /* --- Aset lokal (HTML, CSS, JS): Cache-first --- */
  if (request.method === "GET") {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});

/* =====================
   Strategi: Cache-first
   ===================== */
async function cacheFirst(request, cacheName = DYNAMIC_CACHE) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    /* Offline fallback untuk navigasi */
    if (request.mode === "navigate") {
      const cachedHome = await caches.match("/agrivisv2/index.html");
      if (cachedHome) return cachedHome;
    }
    return offlineResponse("page");
  }
}

/* =====================
   Strategi: Network-first
   ===================== */
async function networkFirst(request) {
  try {
    const response = await fetch(request);

    if (response.ok && request.method === "GET") {
      const cache = await caches.open(DYNAMIC_CACHE);
      await cache.put(request, response.clone());
    }

    return response;
  } catch (err) {
    if (request.method === "GET") {
      const cached = await caches.match(request);
      if (cached) return cached;
    }

    return offlineResponse("api");
  }
}

/* =====================
   Offline fallback response
   ===================== */
function offlineResponse(type) {
  if (type === "api") {
    return new Response(
      JSON.stringify({
        error: "offline",
        message: "Tidak ada koneksi internet",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
  /* Halaman offline minimal */
  return new Response(
    `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline — Hidroponik Melon</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f5f4ef;
      color: #1a1a18;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
      text-align: center;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #1c1c1a; color: #e8e6de; }
      .card { background: #242422; border-color: rgba(255,255,255,0.1); }
    }
    .card {
      background: #fff;
      border: 0.5px solid rgba(0,0,0,0.1);
      border-radius: 12px;
      padding: 2rem;
      max-width: 380px;
      width: 100%;
    }
    .emoji { font-size: 48px; margin-bottom: 1rem; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    p { font-size: 13px; color: #5f5e5a; line-height: 1.6; margin-bottom: 1.25rem; }
    button {
      background: #1d9e75;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      width: 100%;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">🍈</div>
    <h1>Tidak Ada Koneksi</h1>
    <p>Dashboard Hidroponik Melon memerlukan koneksi internet untuk mengambil data sensor dari Firebase. Periksa koneksi Anda dan coba lagi.</p>
    <button onclick="location.reload()">🔄 Coba Lagi</button>
  </div>
</body>
</html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

/* =====================
   Push Notification handler (opsional, untuk masa depan)
   ===================== */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || "Hidroponik Melon", {
    body: data.body || "Ada notifikasi baru dari sistem",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-96.png",
    tag: "hidromelon-alert",
    renotify: true,
    data: { url: data.url || "/agrivisv2/" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/agrivisv2/";
  event.waitUntil(clients.openWindow(url));
});
