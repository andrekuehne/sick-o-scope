// The history module: everything the app derives from Check-ins, as pure functions of the
// Members and their Check-ins. No I/O; shared by the client and the Worker.
// A Gap (no Check-in) is always its own status, never Healthy.

import type { CheckIn, CheckInState, Severity } from "./check-ins.ts";
import { addDays, daysBetweenInclusive } from "./dates.ts";
import type { Member } from "./members.ts";
import type { SymptomKey } from "./symptoms.ts";

export type DayStatus =
  | { kind: "gap" }
  | { kind: "healthy" }
  | { kind: "sick"; severity: Severity; symptoms: SymptomKey[] };

/** One date from the Family's point of view: its active Members, and how many have a Check-in. */
export type FamilyDay = {
  date: string;
  members: { member: Member; status: DayStatus }[];
  checkedIn: number;
  total: number;
};

/** A Member's Streak: consecutive days with the same status, up to and including the day asked about. */
export type MemberStreak = { kind: "healthy" | "sick"; from: string; days: number };

/** A Family Streak: consecutive days on which everyone in the Family was Healthy. */
export type FamilyStreak = { from: string; to: string; days: number };

/**
 * One-tap Check-ins built from the Member's previous day: Wie gestern copies it, and Gleich,
 * Besser and Schlechter follow a Sick day. The note is never copied.
 */
export type Shortcut = "like-yesterday" | "same" | "better" | "worse";

export type History = {
  statusOf(memberId: string, date: string): DayStatus;
  day(date: string): FamilyDay;
  /** The Member's Streak ending on `date` ("Tag N" when Sick); null on a Gap. */
  memberStreak(memberId: string, date: string): MemberStreak | null;
  /** The complete state the shortcut would save on `date`; null when it makes no sense there. */
  shortcut(shortcut: Shortcut, memberId: string, date: string): CheckInState | null;
  /**
   * The everyone-Healthy Streak as of `date`, and the one before it. While `date` is still
   * being logged (Gaps, but nobody Sick), the current Streak runs through the day before.
   * Archived Members don't count, and a Member only counts from their first Check-in on.
   */
  familyStreaks(date: string): { current: FamilyStreak | null; previous: FamilyStreak | null };
};

export function createHistory(members: Member[], checkIns: CheckIn[]): History {
  const byMemberAndDate = new Map(checkIns.map((c) => [key(c.memberId, c.date), c]));
  const active = members.filter((member) => !member.archived);
  const firstCheckIn = new Map<string, string>();
  for (const c of checkIns) {
    const first = firstCheckIn.get(c.memberId);
    if (!first || c.date < first) firstCheckIn.set(c.memberId, c.date);
  }
  const firstDates = active.flatMap((m) => firstCheckIn.get(m.id) ?? []);
  const earliest = firstDates.length > 0 ? firstDates.reduce((a, b) => (a < b ? a : b)) : null;

  function statusOf(memberId: string, date: string): DayStatus {
    const checkIn = byMemberAndDate.get(key(memberId, date));
    if (!checkIn) return { kind: "gap" };
    if (checkIn.status === "healthy") return { kind: "healthy" };
    return { kind: "sick", severity: checkIn.severity, symptoms: checkIn.symptoms };
  }

  function day(date: string): FamilyDay {
    const statuses = active.map((member) => ({ member, status: statusOf(member.id, date) }));
    return {
      date,
      members: statuses,
      checkedIn: statuses.filter((s) => s.status.kind !== "gap").length,
      total: statuses.length,
    };
  }

  function memberStreak(memberId: string, date: string): MemberStreak | null {
    const kind = statusOf(memberId, date).kind;
    if (kind === "gap") return null;
    const from = streakStart(date, (day) => statusOf(memberId, day).kind === kind);
    return { kind, from, days: daysBetweenInclusive(from, date) };
  }

  function shortcut(shortcut: Shortcut, memberId: string, date: string): CheckInState | null {
    const previous = statusOf(memberId, addDays(date, -1));
    if (previous.kind === "gap") return null;
    if (previous.kind === "healthy") return shortcut === "like-yesterday" ? { status: "healthy", note: null } : null;

    const change = { "like-yesterday": 0, same: 0, better: -1, worse: 1 }[shortcut];
    const severity = Math.min(5, previous.severity + change);
    if (severity < 1) return { status: "healthy", note: null };
    return { status: "sick", severity: severity as Severity, symptoms: [...previous.symptoms], note: null };
  }

  /**
   * Whether everyone who counts on `date` was Healthy, it's not all logged yet, or neither
   * (someone was Sick, or nobody counts yet).
   */
  function familyDay(date: string): "healthy" | "pending" | "not-healthy" {
    const counted = active.filter((m) => {
      const first = firstCheckIn.get(m.id);
      return first !== undefined && first <= date;
    });
    if (counted.length === 0) return "not-healthy";
    const kinds = counted.map((m) => statusOf(m.id, date).kind);
    if (kinds.includes("sick")) return "not-healthy";
    return kinds.includes("gap") ? "pending" : "healthy";
  }

  function familyStreakEndingOn(to: string): FamilyStreak | null {
    if (familyDay(to) !== "healthy") return null;
    const from = streakStart(to, (day) => familyDay(day) === "healthy");
    return { from, to, days: daysBetweenInclusive(from, to) };
  }

  function familyStreaks(date: string) {
    if (earliest === null) return { current: null, previous: null };
    const current = familyStreakEndingOn(familyDay(date) === "pending" ? addDays(date, -1) : date);
    let cursor = addDays(current ? current.from : date, -1);
    while (cursor >= earliest && familyDay(cursor) !== "healthy") cursor = addDays(cursor, -1);
    return { current, previous: cursor >= earliest ? familyStreakEndingOn(cursor) : null };
  }

  return { statusOf, day, memberStreak, shortcut, familyStreaks };
}

/** The first day of the Streak ending on `to`, given which days belong to it. */
function streakStart(to: string, belongs: (date: string) => boolean): string {
  let from = to;
  while (belongs(addDays(from, -1))) from = addDays(from, -1);
  return from;
}

function key(memberId: string, date: string) {
  return `${memberId}|${date}`;
}
