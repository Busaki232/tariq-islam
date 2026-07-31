// Service Worker for Push Notifications
const CACHE_NAME = 'tariq-islam-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Push event handler
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  if (!event.data) {
    console.log('Push event has no data');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error('Failed to parse push data:', e);
    data = {
      title: 'New Notification',
      body: event.data.text() || 'You have a new notification',
      icon: '/favicon.ico',
    };
  }

  const { title, body, icon, badge, data: notificationData, actions } = data;

  const options = {
    body: body || 'You have a new notification',
    icon: icon || '/favicon.ico',
    badge: badge || '/favicon.ico',
    vibrate: [200, 100, 200],
    data: notificationData || {},
    actions: actions || [],
    tag: notificationData?.type || 'default',
    requireInteraction: notificationData?.priority >= 4,
  };

  event.waitUntil(
    self.registration.showNotification(title || 'Tariq Islam', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';
  
  // Handle action buttons
  if (event.action) {
    console.log('Action clicked:', event.action);
    
    if (event.action === 'reply') {
      // Open to message compose
      event.waitUntil(
        clients.openWindow(urlToOpen + '?action=reply')
      );
      return;
    } else if (event.action === 'join_call') {
      // Open to call
      event.waitUntil(
        clients.openWindow(event.notification.data?.callUrl || urlToOpen)
      );
      return;
    }
  }

  // Default click behavior - open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (let client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus().then(() => {
              // Navigate to the URL
              return client.navigate(urlToOpen);
            });
          }
        }
        // No window open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle push subscription change
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('Push subscription changed');
  
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey
    })
    .then((newSubscription) => {
      // Send new subscription to server
      return fetch('/api/update-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oldEndpoint: event.oldSubscription?.endpoint,
          newSubscription: newSubscription.toJSON(),
        }),
      });
    })
  );
});
