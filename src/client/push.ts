// This Device's push subscription, which Reminders are delivered to (public/push-sw.js shows them).

import type { ReminderInput } from "../shared/reminders.ts";

/**
 * Whether this Device can get Reminders: it needs notifications, push and the app's service
 * worker, which only production builds register (src/client/main.tsx).
 */
export function pushAvailable(): boolean {
  return import.meta.env.PROD && "Notification" in window && "PushManager" in window && "serviceWorker" in navigator;
}

/** True when notifications for this app are blocked in the browser's settings. */
export function notificationsBlocked(): boolean {
  return pushAvailable() && Notification.permission === "denied";
}

/** Asks for permission to notify (once; later answers come from the browser's setting). */
export async function allowNotifications(): Promise<boolean> {
  return (await Notification.requestPermission()) === "granted";
}

/**
 * This Device's push subscription for this key, subscribing first if there is none yet.
 * One made with another (replaced) key is useless, so it is replaced too.
 */
export async function pushSubscription(vapidPublicKey: string): Promise<ReminderInput["subscription"]> {
  const { pushManager } = await navigator.serviceWorker.ready;
  let subscription = await pushManager.getSubscription();
  if (subscription && !sameKey(subscription.options.applicationServerKey, vapidPublicKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidPublicKey });
  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error("incomplete push subscription");
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

/** Ends this Device's push subscription, if it has one. */
export async function endPushSubscription(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  await (await registration?.pushManager.getSubscription())?.unsubscribe();
}

function sameKey(key: ArrayBuffer | null, base64Url: string): boolean {
  if (!key) return false;
  const encoded = btoa(String.fromCharCode(...new Uint8Array(key)));
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") === base64Url;
}
