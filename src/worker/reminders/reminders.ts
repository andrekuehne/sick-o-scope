// Devices' Reminders. Every query on `reminders` lives here.

import type { ReminderInput } from "../../shared/reminders.ts";
import { SIGNED_IN_FAMILY_DEVICES_SQL } from "../auth/devices.ts";
import type { ReminderToCheck } from "./due-reminders.ts";

/** A Device's own Reminder in this Family: its time, or null when it has none. */
export async function reminderOf(db: D1Database, familyId: string, deviceId: string): Promise<{ time: string } | null> {
  return db
    .prepare("SELECT time FROM reminders WHERE device_id = ? AND family_id = ?")
    .bind(deviceId, familyId)
    .first<{ time: string }>();
}

/**
 * Switches on or changes a Device's Reminder. When it already went off today, changing the
 * time doesn't make it go off again: the last sent date stays.
 */
export async function saveReminder(
  db: D1Database,
  { familyId, deviceId, input, now }: { familyId: string; deviceId: string; input: ReminderInput; now: Date },
): Promise<void> {
  const at = now.toISOString();
  const { endpoint, keys } = input.subscription;
  await db
    .prepare(
      `INSERT INTO reminders (device_id, family_id, time, time_zone, push_endpoint, push_p256dh, push_auth, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (device_id) DO UPDATE SET
         family_id = excluded.family_id, time = excluded.time, time_zone = excluded.time_zone,
         push_endpoint = excluded.push_endpoint, push_p256dh = excluded.push_p256dh, push_auth = excluded.push_auth,
         updated_at = excluded.updated_at`,
    )
    .bind(deviceId, familyId, input.time, input.timeZone, endpoint, keys.p256dh, keys.auth, at, at)
    .run();
}

/** Switches off a Device's Reminder in this Family. */
export async function deleteReminder(db: D1Database, familyId: string, deviceId: string): Promise<void> {
  await db.prepare("DELETE FROM reminders WHERE device_id = ? AND family_id = ?").bind(deviceId, familyId).run();
}

/** Drops a Reminder whose push subscription no longer exists; a statement for a batch. */
export function deleteGoneReminder(db: D1Database, deviceId: string): D1PreparedStatement {
  return db.prepare("DELETE FROM reminders WHERE device_id = ?").bind(deviceId);
}

/**
 * Claims a Reminder for sending on this local date: it returns a row only for the one caller
 * that records the date first, so two overlapping runs of the job never both send it.
 */
export function claimReminder(db: D1Database, deviceId: string, date: string): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE reminders SET last_sent_date = ?
       WHERE device_id = ? AND (last_sent_date IS NULL OR last_sent_date <> ?)
       RETURNING device_id`,
    )
    .bind(date, deviceId, date);
}

/** A Reminder for the scheduled job, with where to push it. */
export type ReminderWithEndpoint = ReminderToCheck & { endpoint: string };

/**
 * Every Reminder of a Device that is still signed in, whose User still belongs to the
 * Reminder's Family.
 */
export async function activeReminders(db: D1Database, now: Date): Promise<ReminderWithEndpoint[]> {
  const { results } = await db
    .prepare(
      `SELECT r.device_id, r.family_id, r.time, r.time_zone, r.last_sent_date, r.push_endpoint FROM reminders r
       JOIN (${SIGNED_IN_FAMILY_DEVICES_SQL}) s ON s.device_id = r.device_id AND s.family_id = r.family_id`,
    )
    .bind(now.toISOString())
    .all<{
      device_id: string;
      family_id: string;
      time: string;
      time_zone: string;
      last_sent_date: string | null;
      push_endpoint: string;
    }>();
  return results.map((r) => ({
    deviceId: r.device_id,
    familyId: r.family_id,
    time: r.time,
    timeZone: r.time_zone,
    lastSentDate: r.last_sent_date,
    endpoint: r.push_endpoint,
  }));
}
