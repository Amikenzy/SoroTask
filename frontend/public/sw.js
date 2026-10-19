const CACHE_PREFIX = "sorotask-pwa-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/offline.css",
  "/manifest.json",
  "/icons/icon.svg",
  "/icons/maskable.svg",
];
const DB_NAME = "sorotask-background-sync";
const DB_VERSION = 1;
const STORE_NAME = "requests";
const SYNC_TAG = "sorotask-offline-requests";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
          }
          return response;
        });
      }),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "QUEUE_BACKGROUND_REQUEST") {
    event.waitUntil(
      storeRequest(event.data.request)
        .then(() => registerSync())
        .then(() => event.ports[0]?.postMessage({ ok: true }))
        .catch((error) => {
          event.ports[0]?.postMessage({
            ok: false,
            error: error instanceof Error ? error.message : "Failed to queue the request.",
          });
        }),
    );
  }
  if (event.data?.type === "FLUSH_BACKGROUND_REQUESTS") {
    event.waitUntil(flushRequests());
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(flushRequests());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() || "A SoroTask event needs your attention." };
  }

  const title = typeof payload.title === "string" ? payload.title : "SoroTask alert";
  const body = typeof payload.body === "string" ? payload.body : "A task needs your attention.";
  const target = typeof payload.url === "string" && payload.url.startsWith("/")
    ? payload.url
    : "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon.svg",
      badge: "/icons/icon.svg",
      data: { url: target },
      tag: typeof payload.tag === "string" ? payload.tag : "sorotask-alert",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url === target);
      if (existing) return existing.focus();
      return self.clients.openWindow(target);
    }),
  );
});

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeRequest(request) {
  const allowedMethods = ["POST", "PUT", "PATCH", "DELETE"];
  if (
    !request ||
    typeof request.id !== "string" ||
    typeof request.url !== "string" ||
    !allowedMethods.includes(request.method)
  ) {
    throw new Error("Invalid offline request.");
  }
  const url = new URL(request.url, self.location.origin);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/api/")) {
    throw new Error("Offline requests must target a same-origin API route.");
  }
  if (request.headers && typeof request.headers !== "object") {
    throw new Error("Offline request headers must be an object.");
  }
  if (request.body !== undefined && request.body !== null && typeof request.body !== "string") {
    throw new Error("Offline request body must be a string.");
  }
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({
      id: request.id,
      url: url.href,
      method: request.method,
      headers: request.headers || {},
      body: request.body ?? null,
      createdAt: Date.now(),
    });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function getQueuedRequests() {
  const db = await openDatabase();
  const requests = await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const getAll = transaction.objectStore(STORE_NAME).getAll();
    getAll.onsuccess = () => resolve(getAll.result);
    getAll.onerror = () => reject(getAll.error);
  });
  db.close();
  return requests.sort((a, b) => a.createdAt - b.createdAt);
}

async function removeQueuedRequest(id) {
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function flushRequests() {
  const requests = await getQueuedRequests();
  for (const request of requests) {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      credentials: "same-origin",
    });
    if (!response.ok) {
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        await removeQueuedRequest(request.id);
        await notifyClients({
          type: "BACKGROUND_REQUEST_FAILED",
          id: request.id,
          status: response.status,
        });
        continue;
      }
      throw new Error(`Background request failed with status ${response.status}.`);
    }
    await removeQueuedRequest(request.id);
    await notifyClients({ type: "BACKGROUND_REQUEST_COMPLETED", id: request.id });
  }
}

async function registerSync() {
  if ("sync" in self.registration) {
    await self.registration.sync.register(SYNC_TAG);
    return;
  }
  if (self.navigator.onLine) await flushRequests();
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) client.postMessage(message);
}
