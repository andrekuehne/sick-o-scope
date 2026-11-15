// Reminders in the service worker (imported by the one vite-plugin-pwa generates, see
// vite.config.ts → workbox.importScripts). A push carries no content, so the text is fixed
// here: no health data ever passes through the push service or shows on the lock screen.
// (The one UI text outside src/client/strings.ts: this file runs on its own, unbundled.)

self.addEventListener("push", (event) => {
  event.waitUntil(
    self.registration.showNotification("Zeit für den Check-in 📋", {
      body: "Wie geht's euch heute? Tippe hier zum Eintragen.",
      icon: "/icons/icon-192.png",
      lang: "de",
      // A newer Reminder replaces an older one still showing.
      tag: "daily-reminder",
    }),
  );
});

// Tapping the notification opens Heute: in the app if it's already open, otherwise fresh.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      // Only windows of this app that the service worker controls: those it may navigate.
      const [open] = await self.clients.matchAll({ type: "window" });
      if (!open) return self.clients.openWindow("/");
      const focused = await open.focus();
      if (new URL(focused.url).pathname !== "/") await focused.navigate("/");
    })(),
  );
});
