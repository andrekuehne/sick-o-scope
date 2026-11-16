// The history module: everything the app derives from Check-ins, as pure functions of the
// Members and their Check-ins. No I/O; shared by the client and the Worker.
// A Gap (no Check-in) is always its own status, never Healthy.

import type { CheckIn, CheckInState, Severity } from "./check-ins.ts";
import { addDays, datesBetween, daysBetweenInclusive } from "./dates.ts";
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

/** A Family Streak: consecutive days on which everyone in the Family was Healthy. */
export type FamilyStreak = { from: string; to: string; days: number };

/**
 * A Bug: one illness of one Member (GLOSSARY.md), from its first to its last Sick day, Gaps in
 * between included. `number` counts the Member's Bugs started in the same Season (its label);
 * `length` is in calendar days, `sickDays` counts only the logged Sick days.
 */
export type Bug = {
  from: string;
  to: string;
  number: number;
  season: string;
  sickDays: number;
  length: number;
  worstSeverity: Severity;
};

/** The Bug a Sick day belongs to, and which of its days it is ("Infekt #3 · Tag 4"). */
export type BugDay = { bug: Bug; day: number };

/**
 * One-tap Check-ins built from the Member's previous day: Wie gestern copies it, and Gleich,
 * Besser and Schlechter follow a Sick day. The note is never copied.
 */
export type Shortcut = "like-yesterday" | "same" | "better" | "worse";

/** How far back the gap-fill card looks: Gaps that began earlier (a long break) never prompt. */
export const GAP_FILL_DAYS = 14;

/**
 * Days that Members missed since their last Check-in before today (today itself is left
 * to the day cards), offered for filling. Members with the same missed days share one
 * proposal. `last` is each Member's last Check-in, without its note, for Wie zuletzt.
 */
export type GapProposal = {
  from: string;
  to: string;
  days: number;
  members: { member: Member; last: CheckInState }[];
};

export type History = {
  statusOf(memberId: string, date: string): DayStatus;
  day(date: string): FamilyDay;
  /** The Member's Bugs, oldest first. */
  bugs(memberId: string): Bug[];
  /** The Bug that `date` belongs to; null unless the Member was Sick that day. */
  bugOn(memberId: string, date: string): BugDay | null;
  /**
   * Whether a Sick day on `date` would continue a Bug unless marked Neuer Infekt: the
   * Member's previous Check-in, skipping Gaps, was Sick.
   */
  continuesBug(memberId: string, date: string): boolean;
  /** The complete state the shortcut would save on `date`; null when it makes no sense there. */
  shortcut(shortcut: Shortcut, memberId: string, date: string): CheckInState | null;
  /**
   * The everyone-Healthy Streak as of `date`, and the one before it. While `date` is still
   * being logged (Gaps, but nobody Sick), the current Streak runs through the day before.
   * Archived Members don't count, and a Member only counts from their first Check-in on.
   */
  familyStreaks(date: string): { current: FamilyStreak | null; previous: FamilyStreak | null };
  /** The Gaps from each Member's last Check-in before `today` up to yesterday, if they began at most 14 days back. */
  gapProposals(today: string): GapProposal[];
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

  const bugsByMember = new Map<string, Bug[]>();

  function bugs(memberId: string): Bug[] {
    let found = bugsByMember.get(memberId);
    if (!found) {
      const own = checkIns.filter((c) => c.memberId === memberId).sort((a, b) => (a.date < b.date ? -1 : 1));
      found = bugsOf(own);
      bugsByMember.set(memberId, found);
    }
    return found;
  }

  function bugOn(memberId: string, date: string): BugDay | null {
    if (statusOf(memberId, date).kind !== "sick") return null;
    const bug = bugs(memberId).find((b) => b.from <= date && date <= b.to);
    return bug ? { bug, day: daysBetweenInclusive(bug.from, date) } : null;
  }

  function continuesBug(memberId: string, date: string): boolean {
    return lastCheckInBefore(memberId, date)?.status === "sick";
  }

  function shortcut(shortcut: Shortcut, memberId: string, date: string): CheckInState | null {
    const previous = statusOf(memberId, addDays(date, -1));
    if (previous.kind === "gap") return null;
    if (previous.kind === "healthy") return shortcut === "like-yesterday" ? { status: "healthy", note: null } : null;

    const change = { "like-yesterday": 0, same: 0, better: -1, worse: 1 }[shortcut];
    const severity = Math.min(5, previous.severity + change);
    // Besser from Fast gesund (0) is a Healthy day.
    if (severity < 0) return { status: "healthy", note: null };
    // A shortcut follows the same Bug, even from a day that started a new one.
    return { status: "sick", severity: severity as Severity, symptoms: [...previous.symptoms], note: null, newBug: false };
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

  function gapProposals(today: string): GapProposal[] {
    // Every run of Gaps ends yesterday, so runs that start on the same day are the same.
    const byFirstMissedDay = new Map<string, GapProposal>();
    const to = addDays(today, -1);
    for (const member of active) {
      const last = lastCheckInBefore(member.id, today);
      if (!last) continue;
      const from = addDays(last.date, 1);
      if (from > to || from < addDays(today, -GAP_FILL_DAYS)) continue;
      const proposal = byFirstMissedDay.get(from) ?? { from, to, days: daysBetweenInclusive(from, to), members: [] };
      proposal.members.push({ member, last: withoutNote(last) });
      byFirstMissedDay.set(from, proposal);
    }
    return [...byFirstMissedDay.values()];
  }

  function lastCheckInBefore(memberId: string, date: string): CheckIn | undefined {
    let last: CheckIn | undefined;
    for (const c of checkIns) if (c.memberId === memberId && c.date < date && (!last || c.date > last.date)) last = c;
    return last;
  }

  return { statusOf, day, bugs, bugOn, continuesBug, shortcut, familyStreaks, gapProposals };
}

/**
 * One Member's Bugs from their Check-ins in date order. A Sick day starts a Bug when the
 * previous Check-in (Gaps don't count) wasn't Sick, or when it says so; a Healthy day ends one.
 */
function bugsOf(checkIns: CheckIn[]): Bug[] {
  const found: Bug[] = [];
  const perSeason = new Map<string, number>();
  let current: Bug | null = null;
  for (const c of checkIns) {
    if (c.status === "healthy") {
      current = null;
      continue;
    }
    if (!current || c.newBug) {
      const season = seasonOf(c.date).label;
      const number = (perSeason.get(season) ?? 0) + 1;
      perSeason.set(season, number);
      current = { from: c.date, to: c.date, number, season, sickDays: 0, length: 0, worstSeverity: c.severity };
      found.push(current);
    }
    current.to = c.date;
    current.sickDays += 1;
    current.length = daysBetweenInclusive(current.from, c.date);
    if (c.severity > current.worstSeverity) current.worstSeverity = c.severity;
  }
  return found;
}

/** A Season: 1 September to 31 August, labelled like "2026/27". */
export type Season = { label: string; start: string; end: string };

/** The Season `date` belongs to. */
export function seasonOf(date: string): Season {
  const year = Number(date.slice(0, 4));
  const startYear = date.slice(5) >= "09-01" ? year : year - 1;
  return {
    label: `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`,
    start: `${startYear}-09-01`,
    end: `${startYear + 1}-08-31`,
  };
}

/** Every missed day of every Member in a proposal, day by day. */
export function missedDays(proposal: GapProposal): { member: Member; last: CheckInState; date: string }[] {
  return datesBetween(proposal.from, proposal.to).flatMap((date) => proposal.members.map((m) => ({ ...m, date })));
}

/** A Check-in's state to copy onto another day: everything but the note, continuing its Bug. */
function withoutNote(checkIn: CheckIn): CheckInState {
  if (checkIn.status === "healthy") return { status: "healthy", note: null };
  return { status: "sick", severity: checkIn.severity, symptoms: [...checkIn.symptoms], note: null, newBug: false };
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
