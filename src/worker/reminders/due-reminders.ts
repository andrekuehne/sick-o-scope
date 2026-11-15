// Which Reminders go off now. Pure: the scheduled job (reminder-job.ts) loads the data,
// asks this, and sends the pushes.

import type { CheckIn } from "../../shared/check-ins.ts";
import type { Member } from "../../shared/members.ts";

/** A Device's Reminder as the scheduled job sees it. */
export type ReminderToCheck = {
  deviceId: string;
  familyId: string;
  /** Local time of day, "HH:MM", on a quarter hour. */
  time: string;
  /** The Device's IANA timezone, e.g. "Europe/Berlin". */
  timeZone: string;
  /** The Device's local date the Reminder last went off on. */
  lastSentDate: string | null;
};

/** What decides whether a Family's day is done: its Members, and Check-ins around today. */
export type FamilyDay = {
  members: Pick<Member, "id" | "archived">[];
  checkIns: Pick<CheckIn, "memberId" | "date">[];
};

/** A Reminder to send now, for this local date. */
export type DueReminder = { deviceId: string; date: string };

/**
 * The Reminders that go off now: it is their time (this quarter hour) on their Device's
 * clock, and the day there isn't done yet.
 */
export function dueReminders(now: Date, reminders: ReminderToCheck[], families: ReadonlyMap<string, FamilyDay>): DueReminder[] {
  const due: DueReminder[] = [];
  for (const reminder of reminders) {
    const local = localDateAndQuarterHour(now, reminder.timeZone);
    if (local.time !== reminder.time || reminder.lastSentDate === local.date) continue;
    const family = families.get(reminder.familyId);
    if (!family || isDone(family, local.date)) continue;
    due.push({ deviceId: reminder.deviceId, date: local.date });
  }
  return due;
}

/** A day is done when every active Member has a Check-in for it (so also when there are none). */
function isDone(family: FamilyDay, date: string): boolean {
  const logged = new Set(family.checkIns.filter((c) => c.date === date).map((c) => c.memberId));
  return family.members.every((m) => m.archived || logged.has(m.id));
}

/** The local date and the quarter hour it is now ("20:00" from 20:00 to 20:14) in a timezone. */
function localDateAndQuarterHour(now: Date, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const quarter = String(Math.floor(Number(part("minute")) / 15) * 15).padStart(2, "0");
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${quarter}` };
}
