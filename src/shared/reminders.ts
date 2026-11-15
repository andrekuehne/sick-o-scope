// A Device's daily Reminder (GLOSSARY.md): what the app sends and gets back.

import { z } from "zod";

/** Every time a Reminder can be set to: the day's quarter hours, "00:00" to "23:45". */
export const REMINDER_TIMES: readonly string[] = Array.from({ length: 96 }, (_, i) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(i / 4))}:${pad((i % 4) * 15)}`;
});

export const ReminderTime = z.string().refine((time) => REMINDER_TIMES.includes(time), "a quarter hour like 20:00");

/** True for an IANA timezone this runtime knows, like "Europe/Berlin". */
function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * The browser's push services. The Worker posts to a subscription's endpoint every day,
 * so it only accepts endpoints there, never any address a client makes up.
 */
const PUSH_SERVICE_HOSTS = [/^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /\.push\.apple\.com$/];

function isPushServiceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && PUSH_SERVICE_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
}

/** A browser's push subscription, as `PushSubscription.toJSON()` gives it. */
export const PushSubscriptionJson = z.object({
  endpoint: z.string().max(1000).refine(isPushServiceUrl, "a push service address"),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Switching on or changing this Device's Reminder. The timezone is the Device's own. */
export const ReminderInput = z.object({
  time: ReminderTime,
  timeZone: z.string().max(100).refine(isTimeZone, "a timezone like Europe/Berlin"),
  subscription: PushSubscriptionJson,
});
export type ReminderInput = z.infer<typeof ReminderInput>;

/** This Device's Reminder (null when off), and the key to subscribe to pushes with. */
export const ThisDeviceReminder = z.object({
  reminder: z.object({ time: ReminderTime }).nullable(),
  vapidPublicKey: z.string(),
});
export type ThisDeviceReminder = z.infer<typeof ThisDeviceReminder>;
