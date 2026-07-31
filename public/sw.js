// Tariq Islam Service Worker
// Push notifications + offline application support

const CACHE_NAME = "tariq-islam-app-v2";

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.png",
  "/tariq-logo.png",
];

// Install: save the basic application shell.
self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache entries separately so one missing optional file
      // does not cause the entire installation to fail.
      await Promise.allSettled(
        APP_SHELL.map((url) => cache.add(url))
      );
    })
  );

  self.skipWaiting();
});

// Activate: remove old Tariq Islam caches.
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating...");

  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName.startsWith("tariq-islam-") &&
            cacheName !== CACHE_NAME
          ) {
            return caches.delete(cacheName);
          }

          return Promise.resolve(false);
        })
      )
    )
  );

  return self.clients.claim();
});

const isCacheableAsset = (request, url) => {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;

  return (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font" ||
    request.destination === "image" ||
    request.destination === "manifest"
  );
};

// Fetch handling:
// - Navigations: network first, cached app shell when offline.
// - Static assets: cache first, then network and save.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  // Never interfere with browser extensions or foreign origins.
  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const responseCopy = response.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put("/index.html", responseCopy);
            });
          }

          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);

          return (
            (await cache.match("/index.html")) ||
            (await cache.match("/")) ||
            new Response(
              "Tariq Islam is offline. Reconnect and reload the app once.",
              {
                status: 503,
                headers: {
                  "Content-Type": "text/plain; charset=utf-8",
                },
              }
            )
          );
        })
    );

    return;
  }

  if (isCacheableAsset(request, url)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.ok &&
            networkResponse.type !== "opaque"
          ) {
            const responseCopy = networkResponse.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseCopy);
            });
          }

          return networkResponse;
        });
      })
    );
  }
});

// Push event handler
self.addEventListener("push", (event) => {
  console.log("Push notification received:", event);

  if (!event.data) {
    console.log("Push event has no data");
    return;
  }

  let data;

  try {
    data = event.data.json();
  } catch (error) {
    console.error("Failed to parse push data:", error);

    data = {
      title: "New Notification",
      body:
        event.data.text() ||
        "You have a new notification",
      icon: "/favicon.png",
    };
  }

  const {
    title,
    body,
    icon,
    badge,
    data: notificationData,
    actions,
  } = data;

  const options = {
    body: body || "You have a new notification",
    icon: icon || "/favicon.png",
    badge: badge || "/favicon.png",
    vibrate: [200, 100, 200],
    data: notificationData || {},
    actions: actions || [],
    tag: notificationData?.type || "default",
    requireInteraction:
      notificationData?.priority >= 4,
  };

  event.waitUntil(
    self.registration.showNotification(
      title || "Tariq Islam",
      options
    )
  );
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked:", event);

  event.notification.close();

  const urlToOpen =
    event.notification.data?.url || "/";

  if (event.action === "reply") {
    event.waitUntil(
      clients.openWindow(
        `${urlToOpen}?action=reply`
      )
    );
    return;
  }

  if (event.action === "join_call") {
    event.waitUntil(
      clients.openWindow(
        event.notification.data?.callUrl ||
          urlToOpen
      )
    );
    return;
  }

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        for (const client of clientList) {
          if (
            client.url.includes(self.location.origin) &&
            "focus" in client
          ) {
            return client.focus().then(() => {
              if ("navigate" in client) {
                return client.navigate(urlToOpen);
              }

              return client;
            });
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle push subscription changes.
self.addEventListener(
  "pushsubscriptionchange",
  (event) => {
    console.log("Push subscription changed");

    event.waitUntil(
      self.registration.pushManager
        .subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            event.oldSubscription?.options
              ?.applicationServerKey,
        })
        .then((newSubscription) =>
          fetch("/api/update-subscription", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              oldEndpoint:
                event.oldSubscription?.endpoint,
              newSubscription:
                newSubscription.toJSON(),
            }),
          })
        )
    );
  }
);
