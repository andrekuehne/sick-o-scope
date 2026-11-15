import { expect, it } from "vitest";
import { type FamilyDay, type ReminderToCheck, dueReminders } from "../src/worker/reminders/due-reminders.ts";

const reminder = (overrides: Partial<ReminderToCheck> = {}): ReminderToCheck => ({
  deviceId: "andres-phone",
  familyId: "kuehne",
  time: "20:00",
  timeZone: "Europe/Berlin",
  lastSentDate: null,
  ...overrides,
});
/** A Family with one active Member and nothing logged yet. */
const notDone: FamilyDay = { members: [{ id: "luna", archived: false }], checkIns: [] };
const families = (family: FamilyDay = notDone) => new Map([["kuehne", family]]);

it("goes off at the set time in the Device's timezone, during that quarter hour only", () => {
  // In November Berlin is UTC+1: 20:00 there is 19:00 UTC.
  const at = (iso: string) => dueReminders(new Date(iso), [reminder()], families());

  expect(at("2026-11-15T19:00:00Z")).toEqual([{ deviceId: "andres-phone", date: "2026-11-15" }]);
  // The scheduled job may start a little late.
  expect(at("2026-11-15T19:03:20Z")).toEqual([{ deviceId: "andres-phone", date: "2026-11-15" }]);
  expect(at("2026-11-15T18:45:00Z")).toEqual([]);
  expect(at("2026-11-15T19:15:00Z")).toEqual([]);
});

it("follows the Device's clock across a daylight-saving change and in other timezones", () => {
  const due = (iso: string, timeZone: string) =>
    dueReminders(new Date(iso), [reminder({ timeZone })], families()).map((r) => r.date);

  // Berlin moves to summer time (UTC+2) on 2026-03-29: 20:00 is 19:00 UTC the day before, 18:00 UTC after.
  expect(due("2026-03-28T19:00:00Z", "Europe/Berlin")).toEqual(["2026-03-28"]);
  expect(due("2026-03-29T19:00:00Z", "Europe/Berlin")).toEqual([]);
  expect(due("2026-03-29T18:00:00Z", "Europe/Berlin")).toEqual(["2026-03-29"]);
  // New York (UTC-5 in November): 20:00 there is 01:00 UTC on the next UTC day, still the 15th locally.
  expect(due("2026-11-16T01:00:00Z", "America/New_York")).toEqual(["2026-11-15"]);
  // Kolkata is UTC+5:30, so its quarter hours fall on :30 UTC.
  expect(due("2026-11-15T14:30:00Z", "Asia/Kolkata")).toEqual(["2026-11-15"]);
});

it("goes off at most once per local date, even if the time is changed to later that day", () => {
  const now = new Date("2026-11-15T19:30:00Z"); // 20:30 in Berlin
  const sentAt20 = reminder({ time: "20:30", lastSentDate: "2026-11-15" });
  const sentYesterday = reminder({ deviceId: "arianes-phone", time: "20:30", lastSentDate: "2026-11-14" });

  expect(dueReminders(now, [sentAt20, sentYesterday], families())).toEqual([{ deviceId: "arianes-phone", date: "2026-11-15" }]);
});

it("stays quiet when every active Member has a Check-in for the Device's today; archived Members don't count", () => {
  const now = new Date("2026-11-16T01:00:00Z"); // 20:00 on the 15th in New York, already the 16th in UTC
  const inNewYork = [reminder({ timeZone: "America/New_York" })];
  const members = [
    { id: "luna", archived: false },
    { id: "max", archived: false },
    { id: "opa", archived: true },
  ];
  const due = (checkIns: FamilyDay["checkIns"]) => dueReminders(now, inNewYork, families({ members, checkIns }));

  expect(due([{ memberId: "luna", date: "2026-11-15" }])).toEqual([{ deviceId: "andres-phone", date: "2026-11-15" }]);
  // Logged for the UTC date, not the Device's: not done.
  expect(due([{ memberId: "luna", date: "2026-11-15" }, { memberId: "max", date: "2026-11-16" }])).toHaveLength(1);
  // Everyone active is logged; nobody logged for Opa, who is archived.
  expect(due([{ memberId: "luna", date: "2026-11-15" }, { memberId: "max", date: "2026-11-15" }])).toEqual([]);
});
