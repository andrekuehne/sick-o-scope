// The scheduled job (every 15 minutes, wrangler.jsonc): sends the Reminders that are due.

import { addDays, utcToday } from "../../shared/dates.ts";
import { checkInsBetween } from "../check-ins/check-ins.ts";
import { listMembers } from "../members/members.ts";
import { type FamilyDay, dueReminders } from "./due-reminders.ts";
import { activeReminders, claimReminder, deleteGoneReminder } from "./reminders.ts";

/** What the push service made of a push: delivered, the subscription no longer exists, or another failure. */
export type PushOutcome = "sent" | "gone" | "failed";

/** Sends one push, without content, to a subscription's endpoint. */
export type SendPush = (endpoint: string) => Promise<PushOutcome>;

/**
 * Pushes every Reminder that is due at `now`. Each is recorded as sent for its date before
 * it is pushed, so it never goes twice; one that fails isn't tried again until the next day.
 * A subscription the push service reports gone is dropped with its Reminder.
 */
export async function sendDueReminders(db: D1Database, now: Date, sendPush: SendPush): Promise<void> {
  const reminders = await activeReminders(db, now);
  if (reminders.length === 0) return;

  // A Device's today is at most a day away from the UTC date, either way.
  const today = utcToday(now);
  const familyIds = [...new Set(reminders.map((r) => r.familyId))];
  const families = new Map<string, FamilyDay>(
    await Promise.all(
      familyIds.map(async (familyId): Promise<[string, FamilyDay]> => {
        const [members, checkIns] = await Promise.all([
          listMembers(db, familyId),
          checkInsBetween(db, familyId, addDays(today, -1), addDays(today, 1)),
        ]);
        return [familyId, { members, checkIns }];
      }),
    ),
  );

  const due = dueReminders(now, reminders, families);
  if (due.length === 0) return;
  const claims = await db.batch<{ device_id: string }>(due.map((r) => claimReminder(db, r.deviceId, r.date)));
  const claimed = claims.flatMap((claim) => claim.results.map((row) => row.device_id));

  const endpoints = new Map(reminders.map((r) => [r.deviceId, r.endpoint]));
  const outcomes = await Promise.all(
    claimed.map(async (deviceId) => {
      const outcome = await sendPush(endpoints.get(deviceId)!).catch((error: unknown): PushOutcome => {
        console.error("push failed", error);
        return "failed";
      });
      return { deviceId, outcome };
    }),
  );

  const gone = outcomes.filter((o) => o.outcome === "gone").map((o) => deleteGoneReminder(db, o.deviceId));
  if (gone.length > 0) await db.batch(gone);
}
