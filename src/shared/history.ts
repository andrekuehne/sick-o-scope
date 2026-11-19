// The history module: everything the app derives from Check-ins, as pure functions of the
// Members and their Check-ins. No I/O; shared by the client and the Worker.
// A Gap (no Check-in) is always its own status, never Healthy.

import type { CheckIn, CheckInState, Severity } from "./check-ins.ts";
import { addDays, datesBetween, daysBetweenInclusive } from "./dates.ts";
import type { Member } from "./members.ts";
import { SYMPTOM_KEYS, type SymptomKey } from "./symptoms.ts";

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

/** A Streak's first and last day, and its length: a Member's, or everyone-Healthy for the Family. */
export type Streak = { from: string; to: string; days: number };

/**
 * One Member's Season: their Sick days in it, the Bugs that started in it (and the longest's
 * length), their longest Healthy Streak inside it, their worst day, and their 3 most frequent
 * Symptoms by days (ties in catalog order). null where there's none.
 */
export type SeasonStats = {
  member: Member;
  sickDays: number;
  bugs: number;
  longestBug: number | null;
  longestHealthyStreak: number | null;
  worstSeverity: Severity | null;
  topSymptoms: { symptom: SymptomKey; days: number }[];
};

/** How many Symptoms a Member's Season names as their most frequent. */
const TOP_SYMPTOMS = 3;

/**
 * One Member's overview of a Season, for their Person screen: their numbers (null without Check-ins in it), the
 * Bugs that started in it, the previous Season to compare with (its stats null without
 * Check-ins there), and their personal records over all Seasons.
 */
export type MemberOverview = {
  member: Member;
  stats: SeasonStats | null;
  bugs: Bug[];
  previous: { season: Season; stats: SeasonStats | null };
  records: PersonalRecords;
};

/**
 * A Member's own records: their longest Healthy Streak ever (unclipped by Seasons), and their
 * fewest Sick days in a finished Season (a running one never sets it). The earliest when tied;
 * null where there's none.
 */
export type PersonalRecords = {
  longestHealthyStreak: Streak | null;
  fewestSickDays: { season: Season; sickDays: number } | null;
};

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

/**
 * A Family wave ("Welle", GLOSSARY.md): Bugs of at least two Members, joined where one
 * overlaps another Member's or starts at most 5 days after its last Sick day. It runs from the
 * first Bug's start to the last one's end, counts for the Season it started in, and `number`
 * counts the Family's waves started in that Season. `members` are who was caught, in the order
 * their Bugs started: when and who, never who passed a Bug to whom.
 */
export type FamilyWave = {
  from: string;
  to: string;
  season: string;
  number: number;
  members: Member[];
};

/**
 * An Award ("Auszeichnung", GLOSSARY.md): a playful title for a Season, with the number it was
 * won with. The first seven go to whoever did best, sharing it when tied; a Member who won none
 * of them gets one of the last three instead, so nobody goes without.
 */
export type Award =
  /** Eiserne Abwehr: the longest Healthy Streak in the Season. */
  | { kind: "iron-defence"; days: number }
  /** Virensammler: the most Bugs. */
  | { kind: "virus-collector"; bugs: number }
  /** Sofa-Profi: the most Sick days. */
  | { kind: "sofa-pro"; days: number }
  /** Stehaufmännchen: the shortest Bugs on average (in days), among Members with at least 2. */
  | { kind: "bounce-back"; days: number }
  /** Tapferkeitsmedaille: the highest Severity endured, and the most days at it. */
  | { kind: "bravery"; severity: Severity; days: number }
  /** Saisonauftakt: the Season's first Bug. */
  | { kind: "season-opener"; date: string }
  /** Wellenreiter: caught in the most Family waves. */
  | { kind: "wave-rider"; waves: number }
  /** For a Member without any of the above: their most frequent Symptom ("Husten-Champion"). */
  | { kind: "symptom-champion"; symptom: SymptomKey; days: number }
  /** …never Sick in the Season ("Unverwüstlich"). */
  | { kind: "unbreakable" }
  /** …Sick, but never with a Symptom ("Mystery-Champion"). */
  | { kind: "mystery" };

/** An Award of a Season, and who holds it: everyone tied for it. */
export type SeasonAward = { award: Award; members: Member[] };

/** A Bug, and whose it is. */
type MemberBug = { member: Member; bug: Bug };

/** The most days between one Bug's last Sick day and another's start that still join them into a wave. */
const WAVE_BREAK_DAYS = 5;

/** The Bug a Sick day belongs to, and which of its days it is ("Infekt #3 · Tag 4"). */
export type BugDay = { bug: Bug; day: number };

/**
 * The longest Streaks ever (the earliest one when tied): everyone Healthy, the Logging Streak
 * ("Lückenlos"), and each Member's own longest Healthy Streak. null where there was none.
 * The UI calls them "Rekorde"; in the glossary a record is a Check-in, hence the name here.
 */
export type BestStreaks = {
  familyHealthy: Streak | null;
  logging: Streak | null;
  members: { member: Member; healthy: Streak | null }[];
};

/**
 * One-tap Check-ins built from the Member's previous day: Wie gestern copies it, and Gleich,
 * Besser and Schlechter follow a Sick day. The note is never copied.
 */
export type Shortcut = "like-yesterday" | "same" | "better" | "worse";

/** Milestones of the everyone-Healthy Streak, in days. */
export const HEALTHY_MILESTONES = [7, 14, 30, 50, 100] as const;

/** Milestones of the Logging Streak ("Lückenlos"), in days. */
export const LOGGING_MILESTONES = [30, 100] as const;

/**
 * How long a Milestone stays news: a Device that wasn't opened for a few days still celebrates
 * it, but one opened weeks later (or a new one) doesn't celebrate what's long past.
 */
const MILESTONE_NEWS_DAYS = 7;

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
  /** Each Member with Check-ins in the Season, in the Members' order. */
  seasonStats(season: Season): SeasonStats[];
  /** The Family waves started in the Season, oldest first. */
  waves(season: Season): FamilyWave[];
  /**
   * The Season's Awards, among the Members with Check-ins in it: the seven in their fixed
   * order, then the fallbacks in the Members' order. Each Member holds at least one.
   */
  awards(season: Season): SeasonAward[];
  /** One Member's Season and personal records, as of `today`; null for an unknown Member. */
  memberOverview(memberId: string, season: Season, today: string): MemberOverview | null;
  /**
   * The best Streaks ever. A day that isn't fully logged (like today, while it's still being
   * logged) belongs to neither of the Family's. Like the Family Streak, the Logging Streak only
   * counts active Members, each from their first Check-in on.
   */
  bestStreaks(): BestStreaks;
  /**
   * The Logging Streak as of `date`: up to the day before while `date` is still being logged,
   * up to `date` once it's complete; null when the day before wasn't fully logged either.
   */
  loggingStreak(date: string): Streak | null;
  /**
   * Whether the everyone-Healthy Streak as of `date` (see `familyStreaks`) is longer than
   * every earlier one. Matching the best isn't enough, and the first Streak has none to beat.
   */
  beatsBestFamilyStreak(date: string): boolean;
  /** The complete state the shortcut would save on `date`; null when it makes no sense there. */
  shortcut(shortcut: Shortcut, memberId: string, date: string): CheckInState | null;
  /**
   * The everyone-Healthy Streak as of `date`, and the one before it. While `date` is still
   * being logged (Gaps, but nobody Sick), the current Streak runs through the day before.
   * Archived Members don't count, and a Member only counts from their first Check-in on.
   */
  familyStreaks(date: string): { current: Streak | null; previous: Streak | null };
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

  const byMember = new Map<string, { checkIns: CheckIn[]; bugs: Bug[] }>();

  /** The Member's Check-ins in date order, and their Bugs, worked out once. */
  function ofMember(memberId: string) {
    let found = byMember.get(memberId);
    if (!found) {
      const sorted = checkIns.filter((c) => c.memberId === memberId).sort((a, b) => (a.date < b.date ? -1 : 1));
      found = { checkIns: sorted, bugs: bugsOf(sorted) };
      byMember.set(memberId, found);
    }
    return found;
  }

  function bugs(memberId: string): Bug[] {
    return ofMember(memberId).bugs;
  }

  function seasonStats(season: Season): SeasonStats[] {
    return members.flatMap((member) => statsOf(member, season) ?? []);
  }

  /** The Member's Season stats; null when they have no Check-ins in it. */
  function statsOf(member: Member, season: Season): SeasonStats | null {
    const { checkIns: all, bugs: memberBugs } = ofMember(member.id);
    const inSeason = all.filter((c) => season.start <= c.date && c.date <= season.end);
    if (inSeason.length === 0) return null;
    const sick = inSeason.flatMap((c) => (c.status === "sick" ? [c] : []));
    const started = memberBugs.filter((b) => b.season === season.label);
    // Only this Season's days, so a Streak running into it counts from 1 Sep.
    const healthyStreaks = streaksOf(inSeason.filter((c) => c.status === "healthy").map((c) => c.date));
    return {
      member,
      sickDays: sick.length,
      bugs: started.length,
      longestBug: largest(started.map((b) => b.length)),
      longestHealthyStreak: largest(healthyStreaks.map((streak) => streak.days)),
      worstSeverity: largest(sick.map((c) => c.severity)),
      topSymptoms: topSymptoms(sick.map((c) => c.symptoms)),
    };
  }

  function memberOverview(memberId: string, season: Season, today: string): MemberOverview | null {
    const member = members.find((m) => m.id === memberId);
    if (!member) return null;
    const previousSeason = seasonOf(addDays(season.start, -1));
    return {
      member,
      stats: statsOf(member, season),
      bugs: bugs(memberId).filter((b) => b.season === season.label),
      previous: { season: previousSeason, stats: statsOf(member, previousSeason) },
      records: {
        longestHealthyStreak: longestHealthyStreak(memberId),
        fewestSickDays: fewestSickDays(member, today),
      },
    };
  }

  /** The Member's longest Healthy Streak ever, the earliest when tied. */
  function longestHealthyStreak(memberId: string): Streak | null {
    const healthyDates = ofMember(memberId).checkIns.filter((c) => c.status === "healthy").map((c) => c.date);
    return longest(streaksOf(healthyDates));
  }

  /** The Member's finished Season (before `today`'s) with the fewest Sick days, the earliest when tied. */
  function fewestSickDays(member: Member, today: string): PersonalRecords["fewestSickDays"] {
    const running = seasonOf(today);
    const finished = new Map<string, Season>();
    for (const { date } of ofMember(member.id).checkIns) {
      const season = seasonOf(date);
      if (season.end < running.start) finished.set(season.start, season);
    }
    const sickDays = [...finished.values()].map((season) => ({ season, sickDays: statsOf(member, season)?.sickDays ?? 0 }));
    // The biggest of the negated counts is the smallest count.
    return biggest(sickDays, (s) => -s.sickDays);
  }

  /** Every Family wave, worked out once, when first asked for. */
  let allWaves: FamilyWave[] | null = null;

  function waves(season: Season): FamilyWave[] {
    allWaves ??= wavesOf(members.flatMap((member) => bugs(member.id).map((bug) => ({ member, bug }))));
    return allWaves.filter((wave) => wave.season === season.label);
  }

  function awards(season: Season): SeasonAward[] {
    const seasonWaves = waves(season);
    const contenders = seasonStats(season).map((stats): Contender => {
      const sick = ofMember(stats.member.id).checkIns.flatMap((c) =>
        c.status === "sick" && season.start <= c.date && c.date <= season.end ? [c] : [],
      );
      return {
        stats,
        bugs: bugs(stats.member.id).filter((b) => b.season === season.label),
        daysAtWorst: sick.filter((c) => c.severity === stats.worstSeverity).length,
        waves: seasonWaves.filter((wave) => wave.members.some((m) => m.id === stats.member.id)).length,
      };
    });

    const won = AWARD_RULES.flatMap((rule): SeasonAward[] => {
      const entries = contenders.flatMap((contender) => {
        const entry = rule(contender);
        return entry ? [{ member: contender.stats.member, ...entry }] : [];
      });
      const best = biggestBy(entries, (a, b) => compareScores(a.score, b.score));
      if (!best) return [];
      const holders = entries.filter((e) => compareScores(e.score, best.score) === 0).map((e) => e.member);
      return [{ award: best.award, members: holders }];
    });

    // Everyone without an Award gets a fallback; Members with the very same one share it.
    const fallbacks = new Map<string, SeasonAward>();
    for (const { stats } of contenders) {
      if (won.some(({ members: holders }) => holders.some((m) => m.id === stats.member.id))) continue;
      const award = fallbackAward(stats);
      const same = JSON.stringify(award);
      const shared = fallbacks.get(same);
      if (shared) shared.members.push(stats.member);
      else fallbacks.set(same, { award, members: [stats.member] });
    }
    return [...won, ...fallbacks.values()];
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
    // A shortcut follows the same Bug, even from a day that started a new one. Medications
    // aren't copied, as when filling missed days.
    return { status: "sick", severity: severity as Severity, symptoms: [...previous.symptoms], medications: [], note: null, newBug: false };
  }

  /**
   * Whether everyone who counts on `date` was Healthy, it's not all logged yet, or neither
   * (someone was Sick, or nobody counts yet).
   */
  function familyDay(date: string): "healthy" | "pending" | "not-healthy" {
    const counted = countedOn(date);
    if (counted.length === 0) return "not-healthy";
    const kinds = counted.map((m) => statusOf(m.id, date).kind);
    if (kinds.includes("sick")) return "not-healthy";
    return kinds.includes("gap") ? "pending" : "healthy";
  }

  /** The Members who count for the Family on `date`: active ones, from their first Check-in on. */
  function countedOn(date: string): Member[] {
    return active.filter((m) => {
      const first = firstCheckIn.get(m.id);
      return first !== undefined && first <= date;
    });
  }

  /** Whether every Member who counts on `date` has a Check-in then (a day of the Logging Streak). */
  function fullyLogged(date: string): boolean {
    const counted = countedOn(date);
    return counted.length > 0 && counted.every((m) => statusOf(m.id, date).kind !== "gap");
  }

  function bestStreaks(): BestStreaks {
    const memberBests = members.flatMap((member) => {
      if (ofMember(member.id).checkIns.length === 0) return [];
      return [{ member, healthy: longestHealthyStreak(member.id) }];
    });
    return {
      familyHealthy: longest(familyHealthyStreaks()),
      logging: longest(streaksOf(countedDates().filter(fullyLogged))),
      members: memberBests,
    };
  }

  /** Every everyone-Healthy Streak, oldest first. */
  function familyHealthyStreaks(): Streak[] {
    return streaksOf(countedDates().filter((date) => familyDay(date) === "healthy"));
  }

  /** Every day from the first to the last Check-in of a Member who counts for the Family. */
  function countedDates(): string[] {
    const logged = checkIns.filter((c) => active.some((m) => m.id === c.memberId)).map((c) => c.date);
    if (earliest === null || logged.length === 0) return [];
    return datesBetween(earliest, logged.reduce((a, b) => (a > b ? a : b)));
  }

  function beatsBestFamilyStreak(date: string): boolean {
    const { current } = familyStreaks(date);
    if (!current) return false;
    const best = longest(familyHealthyStreaks().filter((streak) => streak.to < current.from));
    return best !== null && current.days > best.days;
  }

  function loggingStreak(date: string): Streak | null {
    const to = fullyLogged(date) ? date : addDays(date, -1);
    if (!fullyLogged(to)) return null;
    const from = streakStart(to, fullyLogged);
    return { from, to, days: daysBetweenInclusive(from, to) };
  }

  function familyStreakEndingOn(to: string): Streak | null {
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
      proposal.members.push({ member, last: stateToCopy(last) });
      byFirstMissedDay.set(from, proposal);
    }
    return [...byFirstMissedDay.values()];
  }

  function lastCheckInBefore(memberId: string, date: string): CheckIn | undefined {
    let last: CheckIn | undefined;
    for (const c of checkIns) if (c.memberId === memberId && c.date < date && (!last || c.date > last.date)) last = c;
    return last;
  }

  return { statusOf, day, bugs, bugOn, continuesBug, seasonStats, waves, awards, memberOverview, bestStreaks, loggingStreak, beatsBestFamilyStreak, shortcut, familyStreaks, gapProposals };
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

/**
 * The Family waves among all Members' Bugs, oldest first. Only Bugs of different Members join:
 * a Member's own Bugs one after another are no wave, and don't stretch one either.
 */
function wavesOf(memberBugs: MemberBug[]): FamilyWave[] {
  const sorted = [...memberBugs].sort((a, b) => (a.bug.from < b.bug.from ? -1 : a.bug.from > b.bug.from ? 1 : 0));
  // Union-find: each Bug points towards its group's first Bug; two groups merge when Bugs in them join.
  const group = sorted.map((_, i) => i);
  const root = (i: number): number => (group[i] === i ? i : (group[i] = root(group[i]!)));
  sorted.forEach((later, j) => {
    for (let i = 0; i < j; i++) {
      const earlier = sorted[i]!;
      if (earlier.member.id !== later.member.id && later.bug.from <= addDays(earlier.bug.to, WAVE_BREAK_DAYS)) {
        group[root(j)] = root(i);
      }
    }
  });

  const byGroup = new Map<number, MemberBug[]>();
  sorted.forEach((entry, i) => byGroup.set(root(i), [...(byGroup.get(root(i)) ?? []), entry]));
  const found = [...byGroup.values()]
    .filter((joined) => joined.length > 1)
    .map((joined) => ({
      from: joined[0]!.bug.from,
      to: joined.map((c) => c.bug.to).reduce((a, b) => (a > b ? a : b)),
      members: [...new Map(joined.map((c) => [c.member.id, c.member])).values()],
    }))
    .sort((a, b) => (a.from < b.from ? -1 : 1));

  const perSeason = new Map<string, number>();
  return found.map((wave) => {
    const season = seasonOf(wave.from).label;
    const number = (perSeason.get(season) ?? 0) + 1;
    perSeason.set(season, number);
    return { from: wave.from, to: wave.to, season, number, members: wave.members };
  });
}

/** What one Member brings to a Season's Awards. */
type Contender = { stats: SeasonStats; bugs: Bug[]; daysAtWorst: number; waves: number };

/**
 * One Award's rule: what a Member would win it with, and their score (higher is better,
 * compared item by item); null when they can't win it, as with a zero.
 */
type AwardRule = (contender: Contender) => { score: number[]; award: Award } | null;

/** The seven Awards that go to whoever did best, in the order they're shown. */
const AWARD_RULES: AwardRule[] = [
  ({ stats: { longestHealthyStreak: days } }) => (days ? { score: [days], award: { kind: "iron-defence", days } } : null),
  ({ stats: { bugs } }) => (bugs > 0 ? { score: [bugs], award: { kind: "virus-collector", bugs } } : null),
  ({ stats: { sickDays: days } }) => (days > 0 ? { score: [days], award: { kind: "sofa-pro", days } } : null),
  ({ bugs }) => {
    if (bugs.length < 2) return null;
    const days = bugs.reduce((sum, bug) => sum + bug.length, 0) / bugs.length;
    // The shorter, the better.
    return { score: [-days], award: { kind: "bounce-back", days } };
  },
  ({ stats: { worstSeverity: severity }, daysAtWorst: days }) =>
    severity ? { score: [severity, days], award: { kind: "bravery", severity, days } } : null,
  // The earlier, the better.
  ({ bugs: [first] }) =>
    first ? { score: [-Number(first.from.replaceAll("-", ""))], award: { kind: "season-opener", date: first.from } } : null,
  ({ waves }) => (waves > 0 ? { score: [waves], award: { kind: "wave-rider", waves } } : null),
];

/** The Award for a Member who won none of the seven. */
function fallbackAward(stats: SeasonStats): Award {
  if (stats.sickDays === 0) return { kind: "unbreakable" };
  const [top] = stats.topSymptoms;
  return top ? { kind: "symptom-champion", symptom: top.symptom, days: top.days } : { kind: "mystery" };
}

/** Compares two scores of the same length item by item: below zero when `a` is worse. */
function compareScores(a: number[], b: number[]): number {
  for (const [i, item] of a.entries()) {
    const difference = item - (b[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
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

/**
 * A Check-in's state to copy onto another day: its status, Severity and Symptoms, continuing its
 * Bug. Not the note, and not the Medications: whether they were taken is worth asking day by day.
 */
function stateToCopy(checkIn: CheckIn): CheckInState {
  if (checkIn.status === "healthy") return { status: "healthy", note: null };
  return { status: "sick", severity: checkIn.severity, symptoms: [...checkIn.symptoms], medications: [], note: null, newBug: false };
}


/** The most frequent Symptoms by days, ties in catalog order: the top 3 at most. */
function topSymptoms(days: SymptomKey[][]): { symptom: SymptomKey; days: number }[] {
  const counted = SYMPTOM_KEYS.map((symptom) => ({ symptom, days: days.filter((d) => d.includes(symptom)).length }));
  // A stable sort keeps the catalog order among ties.
  return counted
    .filter((c) => c.days > 0)
    .sort((a, b) => b.days - a.days)
    .slice(0, TOP_SYMPTOMS);
}

/** The runs of consecutive days among `dates` (in order, each at most once). */
function streaksOf(dates: string[]): Streak[] {
  const streaks: Streak[] = [];
  for (const date of dates) {
    const last = streaks.at(-1);
    if (last && addDays(last.to, 1) === date) {
      last.to = date;
      last.days += 1;
    } else {
      streaks.push({ from: date, to: date, days: 1 });
    }
  }
  return streaks;
}

/**
 * The Milestone (a length in days) the Streak has just reached, that is within the last week;
 * the highest if several. null when none is that recent.
 */
export function milestoneJustReached(streak: Streak | null, milestones: readonly number[]): number | null {
  if (!streak) return null;
  return largest(milestones.filter((days) => streak.days >= days && streak.days - days < MILESTONE_NEWS_DAYS));
}

/** The longest of the Streaks, the earliest one when tied; null when there are none. */
function longest(streaks: Streak[]): Streak | null {
  return biggest(streaks, (streak) => streak.days);
}

/** The largest of the numbers; null when there are none. */
function largest<T extends number>(values: T[]): T | null {
  return biggest(values, (value) => value);
}

/** The item with the biggest size, the first one when tied; null when there are none. */
function biggest<T>(items: T[], size: (item: T) => number): T | null {
  return biggestBy(items, (a, b) => size(a) - size(b));
}

/** The biggest item by `compare` (above zero when its first item is bigger), the first one when tied; null when there are none. */
function biggestBy<T>(items: T[], compare: (a: T, b: T) => number): T | null {
  return items.reduce<T | null>((best, item) => (best === null || compare(item, best) > 0 ? item : best), null);
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
