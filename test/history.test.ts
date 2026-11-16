import { expect, it } from "vitest";
import type { CheckIn } from "../src/shared/check-ins.ts";
import { addDays } from "../src/shared/dates.ts";
import {
  createHistory,
  HEALTHY_MILESTONES,
  LOGGING_MILESTONES,
  milestoneJustReached,
  seasonOf,
} from "../src/shared/history.ts";
import type { Member } from "../src/shared/members.ts";
import type { SymptomKey } from "../src/shared/symptoms.ts";

const member = (id: string, archived = false): Member => ({ id, name: id, emoji: "🦊", colour: "#ff7a59", archived });
const healthy = (memberId: string, date: string): CheckIn => ({
  memberId,
  date,
  status: "healthy",
  note: null,
  updatedBy: "André",
  updatedAt: "2026-11-15T08:00:00.000Z",
});
const sick = (
  memberId: string,
  date: string,
  severity: 0 | 1 | 2 | 3 | 4 | 5,
  symptoms: SymptomKey[] = [],
  newBug = false,
): CheckIn => ({
  ...healthy(memberId, date),
  status: "sick",
  severity,
  symptoms,
  newBug,
});

it("tells each Member's status on a day: Healthy, Sick, or a Gap when nothing was logged", () => {
  const history = createHistory(
    [member("luna"), member("max")],
    [healthy("luna", "2026-11-14"), sick("max", "2026-11-14", 3, ["cough"])],
  );

  expect(history.statusOf("luna", "2026-11-14")).toEqual({ kind: "healthy" });
  expect(history.statusOf("max", "2026-11-14")).toEqual({ kind: "sick", severity: 3, symptoms: ["cough"] });
  expect(history.statusOf("luna", "2026-11-15")).toEqual({ kind: "gap" });
});

it("shows a day for the active Members only, and counts only explicit Check-ins", () => {
  const history = createHistory(
    [member("luna"), member("max"), member("oma", true), member("ben")],
    [healthy("luna", "2026-11-15"), sick("max", "2026-11-15", 1), healthy("oma", "2026-11-15")],
  );

  const day = history.day("2026-11-15");
  expect(day.members.map((m) => [m.member.id, m.status.kind])).toEqual([
    ["luna", "healthy"],
    ["max", "sick"],
    ["ben", "gap"],
  ]);
  // Ben's Gap is not Healthy, and archived Oma doesn't count at all.
  expect(day.checkedIn).toBe(2);
  expect(day.total).toBe(3);
});

it("still knows an archived Member's past days", () => {
  const history = createHistory([member("oma", true)], [sick("oma", "2026-10-01", 4)]);
  expect(history.statusOf("oma", "2026-10-01")).toEqual({ kind: "sick", severity: 4, symptoms: [] });
});

it("keeps a Bug together over a Gap and ends it with a Healthy day; the next Sick day starts a new one", () => {
  const history = createHistory(
    [member("luna")],
    [
      sick("luna", "2026-11-02", 3, ["cough"]), // her first Check-in: Bug #1
      sick("luna", "2026-11-03", 4), // the 4th is a Gap: still the same Bug
      sick("luna", "2026-11-05", 0, ["runny-nose"]), // Fast gesund belongs to it too
      healthy("luna", "2026-11-06"),
      sick("luna", "2026-11-08", 1), // the 7th is a Gap, but the last Check-in was Healthy: Bug #2
    ],
  );

  expect(history.bugs("luna")).toEqual([
    { from: "2026-11-02", to: "2026-11-05", number: 1, season: "2026/27", sickDays: 3, length: 4, worstSeverity: 4 },
    { from: "2026-11-08", to: "2026-11-08", number: 2, season: "2026/27", sickDays: 1, length: 1, worstSeverity: 1 },
  ]);
  // "Infekt #1 · Tag 4": calendar days since the Bug started, the Gap included.
  expect(history.bugOn("luna", "2026-11-05")).toMatchObject({ bug: { number: 1 }, day: 4 });
  expect(history.bugOn("luna", "2026-11-04")).toBeNull(); // a Gap is no Sick day
  expect(history.bugOn("luna", "2026-11-06")).toBeNull();

  // Whether a Sick day there would continue a Bug, so Neuer Infekt is worth asking about.
  expect(history.continuesBug("luna", "2026-11-02")).toBe(false); // nothing before
  expect(history.continuesBug("luna", "2026-11-05")).toBe(true); // over the Gap on the 4th
  expect(history.continuesBug("luna", "2026-11-07")).toBe(false); // after Healthy
});

it("starts a new Bug on a Sick day marked Neuer Infekt, even right after another Sick day", () => {
  const history = createHistory(
    [member("max")],
    [
      sick("max", "2026-11-10", 1, ["runny-nose"]),
      sick("max", "2026-11-11", 0, ["runny-nose"]),
      sick("max", "2026-11-12", 3, ["vomiting"], true), // the stomach bug arrives
      sick("max", "2026-11-13", 2, ["vomiting"]),
    ],
  );

  expect(history.bugs("max").map((b) => [b.from, b.to, b.number])).toEqual([
    ["2026-11-10", "2026-11-11", 1],
    ["2026-11-12", "2026-11-13", 2],
  ]);
  expect(history.bugOn("max", "2026-11-13")).toMatchObject({ bug: { number: 2 }, day: 2 });
});

it("numbers Bugs per Season, counting a Bug that runs past 31 Aug for the Season it started in", () => {
  const history = createHistory(
    [member("luna")],
    [
      sick("luna", "2026-05-04", 2),
      healthy("luna", "2026-05-05"),
      sick("luna", "2026-08-30", 2), // 2025/26's second Bug, still going on 1 Sep
      sick("luna", "2026-08-31", 3),
      sick("luna", "2026-09-01", 2),
      healthy("luna", "2026-09-02"),
      sick("luna", "2026-10-12", 1), // the first Bug that starts in 2026/27
    ],
  );

  expect(history.bugs("luna").map((b) => [b.season, b.number, b.from, b.to])).toEqual([
    ["2025/26", 1, "2026-05-04", "2026-05-04"],
    ["2025/26", 2, "2026-08-30", "2026-09-01"],
    ["2026/27", 1, "2026-10-12", "2026-10-12"],
  ]);
  expect(history.bugOn("luna", "2026-09-01")).toMatchObject({ bug: { season: "2025/26", number: 2 }, day: 3 });
});

it("lowers Besser from Naja to Fast gesund and from Fast gesund to Healthy, and caps Schlechter at 5, keeping the Symptoms", () => {
  const history = createHistory(
    [member("luna"), member("ben"), member("max"), member("oma")],
    [
      sick("luna", "2026-11-14", 0, ["runny-nose"]),
      sick("ben", "2026-11-14", 1, ["cough"]),
      sick("max", "2026-11-14", 5, ["fever", "cough"]),
      sick("oma", "2026-11-14", 3, ["fever"]),
    ],
  );
  const shortcut = history.shortcut;

  expect(shortcut("better", "luna", "2026-11-15")).toEqual({ status: "healthy", note: null });
  expect(shortcut("better", "ben", "2026-11-15")).toEqual({ status: "sick", severity: 0, symptoms: ["cough"], note: null, newBug: false });
  expect(shortcut("worse", "max", "2026-11-15")).toEqual({ status: "sick", severity: 5, symptoms: ["fever", "cough"], note: null, newBug: false });
  expect(shortcut("better", "oma", "2026-11-15")).toEqual({ status: "sick", severity: 2, symptoms: ["fever"], note: null, newBug: false });
  expect(shortcut("worse", "oma", "2026-11-15")).toEqual({ status: "sick", severity: 4, symptoms: ["fever"], note: null, newBug: false });
  expect(shortcut("same", "oma", "2026-11-15")).toEqual({ status: "sick", severity: 3, symptoms: ["fever"], note: null, newBug: false });
});

it("offers Wie gestern only after a logged day, without the note, and Gleich/Besser/Schlechter only after a Sick day", () => {
  const history = createHistory(
    [member("luna"), member("max"), member("ben")],
    [
      // Marked Neuer Infekt: Wie gestern still continues that Bug instead of starting another.
      { ...sick("luna", "2026-11-14", 3, ["cough"], true), note: "Fieber nachts 39,2" },
      healthy("max", "2026-11-14"),
      healthy("ben", "2026-11-13"), // then a Gap on the 14th
    ],
  );

  expect(history.shortcut("like-yesterday", "luna", "2026-11-15")).toEqual({
    status: "sick",
    severity: 3,
    symptoms: ["cough"],
    note: null,
    newBug: false,
  });
  expect(history.shortcut("like-yesterday", "max", "2026-11-15")).toEqual({ status: "healthy", note: null });
  expect(history.shortcut("better", "max", "2026-11-15")).toBeNull();
  for (const shortcut of ["like-yesterday", "same", "better", "worse"] as const) {
    expect(history.shortcut(shortcut, "ben", "2026-11-15")).toBeNull();
  }
});

/** Healthy Check-ins for the Members on every day from `from` to `to`. */
function healthyDays(memberIds: string[], from: string, to: string): CheckIn[] {
  const days: CheckIn[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) for (const id of memberIds) days.push(healthy(id, date));
  return days;
}

it("finds the everyone-Healthy Family Streak: any Sick day breaks it, archived and newly added Members don't", () => {
  const members = [member("luna"), member("max"), member("oma", true), member("baby")];
  const checkIns = [
    ...healthyDays(["luna", "max"], "2026-11-01", "2026-11-04"),
    healthy("luna", "2026-11-05"),
    sick("max", "2026-11-05", 1), // only "Naja", but it still breaks the Streak
    ...healthyDays(["luna", "max"], "2026-11-06", "2026-11-14"),
    sick("oma", "2026-11-08", 4), // archived: doesn't count
    ...healthyDays(["baby"], "2026-11-12", "2026-11-14"), // counts from the first Check-in on
  ];

  // Today is still being logged: the Streak runs through yesterday until someone breaks it.
  const pending = createHistory(members, [...checkIns, healthy("luna", "2026-11-15")]);
  expect(pending.familyStreaks("2026-11-15")).toEqual({
    current: { from: "2026-11-06", to: "2026-11-14", days: 9 },
    previous: { from: "2026-11-01", to: "2026-11-04", days: 4 },
  });

  const broken = createHistory(members, [...checkIns, sick("max", "2026-11-15", 2)]);
  expect(broken.familyStreaks("2026-11-15")).toEqual({
    current: null,
    previous: { from: "2026-11-06", to: "2026-11-14", days: 9 },
  });

  const complete = createHistory(members, [...checkIns, ...healthyDays(["luna", "max", "baby"], "2026-11-15", "2026-11-15")]);
  expect(complete.familyStreaks("2026-11-15").current).toEqual({ from: "2026-11-06", to: "2026-11-15", days: 10 });
});

it("lets a Gap end the Family Streak, and knows when there was none yet", () => {
  const checkIns = [
    ...healthyDays(["luna", "max"], "2026-11-01", "2026-11-03"),
    healthy("luna", "2026-11-04"), // Max has a Gap on the 4th
    ...healthyDays(["luna", "max"], "2026-11-05", "2026-11-06"),
  ];
  const history = createHistory([member("luna"), member("max")], checkIns);

  expect(history.familyStreaks("2026-11-06")).toEqual({
    current: { from: "2026-11-05", to: "2026-11-06", days: 2 },
    previous: { from: "2026-11-01", to: "2026-11-03", days: 3 },
  });
  expect(createHistory([member("luna")], []).familyStreaks("2026-11-06")).toEqual({ current: null, previous: null });
});

it("proposes filling the Gaps since a Member's last Check-in before today, but not Gaps in the middle", () => {
  const history = createHistory(
    [member("luna"), member("max")],
    [
      healthy("luna", "2026-11-08"), // a Gap on the 9th, in the middle: no proposal for it
      { ...sick("luna", "2026-11-10", 2, ["cough"], true), note: "beim Arzt" },
      healthy("luna", "2026-11-15"), // today's already logged; the missed days still count
      ...healthyDays(["max"], "2026-11-08", "2026-11-14"),
    ],
  );

  expect(history.gapProposals("2026-11-15")).toEqual([
    {
      from: "2026-11-11",
      to: "2026-11-14",
      days: 4,
      members: [{ member: member("luna"), last: { status: "sick", severity: 2, symptoms: ["cough"], note: null, newBug: false } }],
    },
  ]);
});

it("prompts only for Gaps that began at most 14 days back, skips Members with no Check-ins and archived ones, and combines shared Gaps", () => {
  const history = createHistory(
    [member("luna"), member("tom"), member("ben"), member("oma", true), member("max"), member("lia")],
    [
      healthy("luna", "2026-10-31"), // missing from 1 Nov on: exactly 14 days
      healthy("tom", "2026-10-30"), // missing for 15 days: a long break never prompts
      healthy("oma", "2026-11-12"),
      sick("max", "2026-11-12", 3),
      healthy("lia", "2026-11-12"),
    ],
  );

  expect(history.gapProposals("2026-11-15")).toEqual([
    { from: "2026-11-01", to: "2026-11-14", days: 14, members: [{ member: member("luna"), last: { status: "healthy", note: null } }] },
    {
      from: "2026-11-13",
      to: "2026-11-14",
      days: 2,
      members: [
        { member: member("max"), last: { status: "sick", severity: 3, symptoms: [], note: null, newBug: false } },
        { member: member("lia"), last: { status: "healthy", note: null } },
      ],
    },
  ]);
  expect(createHistory([member("luna")], [healthy("luna", "2026-11-14")]).gapProposals("2026-11-15")).toEqual([]);
});

it("puts 31 Aug and 1 Sep in different Seasons, each running 1 Sep – 31 Aug", () => {
  expect(seasonOf("2026-08-31")).toEqual({ label: "2025/26", start: "2025-09-01", end: "2026-08-31" });
  expect(seasonOf("2026-09-01")).toEqual({ label: "2026/27", start: "2026-09-01", end: "2027-08-31" });
  expect(seasonOf("2027-02-28")).toEqual({ label: "2026/27", start: "2026-09-01", end: "2027-08-31" });
  expect(seasonOf("2099-12-31").label).toBe("2099/00");
});

it("sums up a Season per Member, with Streaks cut at its start and each Bug counted for the Season it started in", () => {
  const history = createHistory(
    [member("luna"), member("max"), member("oma", true)],
    [
      ...healthyDays(["luna"], "2026-08-25", "2026-09-05"), // 12 days fit, 5 of them in 2026/27
      sick("luna", "2026-09-06", 3, ["cough"]),
      sick("luna", "2026-09-07", 4),
      sick("luna", "2026-09-09", 0, ["runny-nose"]), // the 8th is a Gap: still the first Bug, 4 days long
      ...healthyDays(["luna"], "2026-09-10", "2026-09-12"),
      sick("luna", "2026-09-13", 2), // a second Bug
      sick("max", "2026-08-31", 2), // last Season's Bug, running into this one
      sick("max", "2026-09-01", 1),
      ...healthyDays(["max"], "2026-09-02", "2026-09-03"),
      sick("oma", "2026-03-01", 3), // archived, and nothing in 2026/27
    ],
  );

  expect(history.seasonStats(seasonOf("2026-11-15"))).toEqual([
    {
      member: member("luna"),
      sickDays: 4,
      bugs: 2,
      longestBug: 4,
      longestHealthyStreak: 5,
      worstSeverity: 4,
      // One day each: the runny nose comes first in the catalog.
      topSymptoms: [
        { symptom: "runny-nose", days: 1 },
        { symptom: "cough", days: 1 },
      ],
    },
    // Max's Sick day on 1 Sep counts here, but the Bug belongs to 2025/26.
    { member: member("max"), sickDays: 1, bugs: 0, longestBug: null, longestHealthyStreak: 2, worstSeverity: 1, topSymptoms: [] },
  ]);
  expect(history.seasonStats(seasonOf("2026-03-01"))).toEqual([
    { member: member("luna"), sickDays: 0, bugs: 0, longestBug: null, longestHealthyStreak: 7, worstSeverity: null, topSymptoms: [] },
    { member: member("max"), sickDays: 1, bugs: 1, longestBug: 2, longestHealthyStreak: null, worstSeverity: 2, topSymptoms: [] },
    { member: member("oma", true), sickDays: 1, bugs: 1, longestBug: 1, longestHealthyStreak: null, worstSeverity: 3, topSymptoms: [] },
  ]);
  // Among the best Streaks ever, Luna's Streak across 1 Sep counts whole.
  expect(history.bestStreaks().members[0]).toEqual({
    member: member("luna"),
    healthy: { from: "2026-08-25", to: "2026-09-05", days: 12 },
  });
});

it("keeps the best Streaks ever: everyone Healthy, Lückenlos, and each Member's longest Healthy Streak", () => {
  const history = createHistory(
    [member("luna"), member("max"), member("oma", true)],
    [
      ...healthyDays(["luna"], "2026-11-01", "2026-11-10"),
      // Max only counts from his first Check-in on the 3rd, so the 1st and 2nd are fully logged too.
      ...healthyDays(["max"], "2026-11-03", "2026-11-04"),
      sick("max", "2026-11-05", 1), // breaks everyone-Healthy, but not Lückenlos
      ...healthyDays(["max"], "2026-11-06", "2026-11-14"),
      // Luna's Gap on the 11th ends both Family Streaks.
      ...healthyDays(["luna"], "2026-11-12", "2026-11-15"),
      // Today, the 15th, is only half logged (Max is missing): it doesn't add to anything yet.
      // Archived Oma's long Streak is hers, but she doesn't count for the Family's.
      ...healthyDays(["oma"], "2026-10-01", "2026-10-20"),
    ],
  );

  expect(history.bestStreaks()).toEqual({
    familyHealthy: { from: "2026-11-06", to: "2026-11-10", days: 5 },
    logging: { from: "2026-11-01", to: "2026-11-10", days: 10 },
    members: [
      { member: member("luna"), healthy: { from: "2026-11-01", to: "2026-11-10", days: 10 } },
      { member: member("max"), healthy: { from: "2026-11-06", to: "2026-11-14", days: 9 } },
      { member: member("oma", true), healthy: { from: "2026-10-01", to: "2026-10-20", days: 20 } },
    ],
  });
});

it("has no best Streaks before anything was logged", () => {
  expect(createHistory([member("luna")], []).bestStreaks()).toEqual({ familyHealthy: null, logging: null, members: [] });
});

it("counts the Logging Streak up to yesterday while today is still being logged, and with today once it's complete", () => {
  const members = [member("luna"), member("max")];
  const logged = [
    sick("max", "2026-11-12", 2), // Sick days count as logged too (and win over the Healthy one below)
    ...healthyDays(["luna", "max"], "2026-11-10", "2026-11-14"),
    healthy("luna", "2026-11-15"), // today: Max still missing
  ].filter((c, i, all) => all.findIndex((o) => o.memberId === c.memberId && o.date === c.date) === i);

  expect(createHistory(members, logged).loggingStreak("2026-11-15")).toEqual({ from: "2026-11-10", to: "2026-11-14", days: 5 });
  expect(createHistory(members, [...logged, healthy("max", "2026-11-15")]).loggingStreak("2026-11-15")).toEqual({
    from: "2026-11-10",
    to: "2026-11-15",
    days: 6,
  });
  // A Gap yesterday: nothing to count, even if today is complete.
  const gapYesterday = logged.filter((c) => !(c.memberId === "luna" && c.date === "2026-11-14"));
  expect(createHistory(members, gapYesterday).loggingStreak("2026-11-15")).toBeNull();
});

it("names the Milestone a Streak has just reached (within the last week): 7, 14, 30, 50, 100 days everyone Healthy, 30 and 100 Lückenlos", () => {
  const streak = (days: number) => ({ from: "2026-01-01", to: "2026-01-01", days });

  expect(milestoneJustReached(streak(6), HEALTHY_MILESTONES)).toBeNull();
  expect(milestoneJustReached(streak(7), HEALTHY_MILESTONES)).toBe(7);
  // Still news a few days later, for a Device that wasn't opened in between…
  expect(milestoneJustReached(streak(20), HEALTHY_MILESTONES)).toBe(14);
  // …but not weeks later: 14 was reached 15 days ago, and 30 isn't there yet.
  expect(milestoneJustReached(streak(29), HEALTHY_MILESTONES)).toBeNull();
  expect(milestoneJustReached(streak(106), HEALTHY_MILESTONES)).toBe(100);
  expect(milestoneJustReached(streak(120), HEALTHY_MILESTONES)).toBeNull();
  expect(milestoneJustReached(streak(29), LOGGING_MILESTONES)).toBeNull();
  expect(milestoneJustReached(streak(30), LOGGING_MILESTONES)).toBe(30);
  expect(milestoneJustReached(null, HEALTHY_MILESTONES)).toBeNull();
});

it("knows when the everyone-Healthy Streak beats every earlier one; matching the best isn't enough", () => {
  const members = [member("luna"), member("max")];
  const earlier = [...healthyDays(["luna", "max"], "2026-11-01", "2026-11-05"), sick("max", "2026-11-06", 1)];

  // 5 days now against 5 before: not yet.
  const level = createHistory(members, [...earlier, ...healthyDays(["luna", "max"], "2026-11-07", "2026-11-11")]);
  expect(level.beatsBestFamilyStreak("2026-11-11")).toBe(false);
  // A sixth day: a new best.
  const ahead = createHistory(members, [...earlier, ...healthyDays(["luna", "max"], "2026-11-07", "2026-11-12")]);
  expect(ahead.beatsBestFamilyStreak("2026-11-12")).toBe(true);
  // Today still being logged doesn't take it away: the Streak runs through yesterday.
  expect(ahead.beatsBestFamilyStreak("2026-11-13")).toBe(true);
  // The very first Streak has nothing to beat yet.
  const first = createHistory(members, healthyDays(["luna", "max"], "2026-11-01", "2026-11-20"));
  expect(first.beatsBestFamilyStreak("2026-11-20")).toBe(false);
});

it("shows one Member's Season on their Person screen: numbers, Bugs, and the top 3 Symptoms by days, ties in catalog order", () => {
  const history = createHistory(
    [member("luna"), member("max")],
    [
      sick("luna", "2026-11-02", 3, ["fever", "cough"]),
      sick("luna", "2026-11-03", 4, ["headache", "fever", "cough"]),
      sick("luna", "2026-11-04", 2, ["headache", "runny-nose"]),
      healthy("luna", "2026-11-05"),
      sick("luna", "2026-11-10", 1, ["sore-throat", "runny-nose", "headache"]),
      sick("max", "2026-11-10", 5, ["vomiting"]), // someone else's
    ],
  );

  const overview = history.memberOverview("luna", seasonOf("2026-11-15"), "2026-11-15");
  expect(overview?.member).toEqual(member("luna"));
  expect(overview?.stats).toEqual({
    member: member("luna"),
    sickDays: 4,
    bugs: 2,
    longestBug: 3,
    longestHealthyStreak: 1,
    worstSeverity: 4,
    // Headache on 3 days; runny nose, cough and fever on 2 each: catalog order picks the first two.
    topSymptoms: [
      { symptom: "headache", days: 3 },
      { symptom: "runny-nose", days: 2 },
      { symptom: "cough", days: 2 },
    ],
  });
  expect(overview?.bugs.map((b) => [b.number, b.from, b.to, b.length, b.worstSeverity])).toEqual([
    [1, "2026-11-02", "2026-11-04", 3, 4],
    [2, "2026-11-10", "2026-11-10", 1, 1],
  ]);
  expect(history.memberOverview("nobody", seasonOf("2026-11-15"), "2026-11-15")).toBeNull();
});

it("compares a Member's Season with their previous one, which may have no Check-ins of theirs", () => {
  const history = createHistory(
    [member("luna"), member("max")],
    [
      sick("luna", "2025-01-10", 2), // 2024/25: one Bug, 2 Sick days
      sick("luna", "2025-01-11", 2),
      sick("luna", "2026-11-02", 3), // 2026/27
      sick("max", "2026-03-01", 1), // 2025/26 has only Max's Check-ins
    ],
  );

  const thisSeason = history.memberOverview("luna", seasonOf("2026-11-15"), "2026-11-15");
  expect(thisSeason?.previous).toEqual({ season: seasonOf("2026-03-01"), stats: null });

  const lastSeason = history.memberOverview("luna", seasonOf("2026-03-01"), "2026-11-15");
  expect(lastSeason?.stats).toBeNull();
  expect(lastSeason?.previous.season).toEqual(seasonOf("2025-01-10"));
  expect(lastSeason?.previous.stats).toMatchObject({ sickDays: 2, bugs: 1 });
});

it("keeps personal records: the longest Healthy Streak ever, and the fewest Sick days in a finished Season", () => {
  const history = createHistory(
    [member("luna"), member("max")],
    [
      sick("luna", "2025-01-10", 2), // 2024/25: 3 Sick days
      sick("luna", "2025-01-11", 2),
      sick("luna", "2025-01-12", 2),
      ...healthyDays(["luna"], "2025-08-25", "2025-09-05"), // 12 days, across 1 Sep
      sick("luna", "2025-10-01", 1), // 2025/26: 1 Sick day
      ...healthyDays(["luna"], "2026-09-01", "2026-09-03"), // 2026/27, still running: none yet
      healthy("max", "2026-11-01"),
    ],
  );

  expect(history.memberOverview("luna", seasonOf("2026-11-15"), "2026-11-15")?.records).toEqual({
    longestHealthyStreak: { from: "2025-08-25", to: "2025-09-05", days: 12 },
    // The running Season's 0 Sick days don't count (yet).
    fewestSickDays: { season: seasonOf("2025-10-01"), sickDays: 1 },
  });
  // Whichever Season is shown, the records are the same.
  expect(history.memberOverview("luna", seasonOf("2025-01-10"), "2026-11-15")?.records.fewestSickDays?.sickDays).toBe(1);
  // Max has only the running Season.
  expect(history.memberOverview("max", seasonOf("2026-11-15"), "2026-11-15")?.records).toEqual({
    longestHealthyStreak: { from: "2026-11-01", to: "2026-11-01", days: 1 },
    fewestSickDays: null,
  });
});

it("finds a Family wave where Bugs of different Members overlap, naming who was caught in the order their Bugs started", () => {
  const history = createHistory(
    [member("luna"), member("max"), member("sam")],
    [
      sick("max", "2026-11-03", 2),
      sick("max", "2026-11-04", 3),
      sick("luna", "2026-11-04", 1), // overlaps Max's Bug
      sick("luna", "2026-11-06", 1), // the 5th is a Gap: still her Bug
      healthy("sam", "2026-11-05"),
    ],
  );

  expect(history.waves(seasonOf("2026-11-15"))).toEqual([
    { from: "2026-11-03", to: "2026-11-06", season: "2026/27", number: 1, members: [member("max"), member("luna")] },
  ]);
});

it("joins a Bug that starts 5 days after another Member's last Sick day into the wave, but not one that starts 6 days after", () => {
  const members = [member("luna"), member("max")];
  const lunasBug = [sick("luna", "2026-11-01", 2), sick("luna", "2026-11-02", 2), healthy("luna", "2026-11-03")];

  const fiveDays = createHistory(members, [...lunasBug, sick("max", "2026-11-07", 1)]);
  expect(fiveDays.waves(seasonOf("2026-11-15"))).toEqual([
    { from: "2026-11-01", to: "2026-11-07", season: "2026/27", number: 1, members: [member("luna"), member("max")] },
  ]);
  const sixDays = createHistory(members, [...lunasBug, sick("max", "2026-11-08", 1)]);
  expect(sixDays.waves(seasonOf("2026-11-15"))).toEqual([]);
});

it("keeps three Bugs in one wave, one after another, even when the first and last don't touch, and numbers the waves in a Season", () => {
  const history = createHistory(
    [member("luna"), member("max"), member("sam")],
    [
      sick("luna", "2026-10-01", 3),
      sick("max", "2026-10-04", 2), // 3 days after Luna's
      sick("sam", "2026-10-09", 1), // 5 days after Max's, 8 after Luna's
      ...["luna", "max", "sam"].map((id) => healthy(id, "2026-10-10")), // everyone's Bug over
      sick("luna", "2026-12-01", 2), // a later wave
      sick("sam", "2026-12-02", 2),
    ],
  );

  expect(history.waves(seasonOf("2026-11-15"))).toEqual([
    {
      from: "2026-10-01",
      to: "2026-10-09",
      season: "2026/27",
      number: 1,
      members: [member("luna"), member("max"), member("sam")],
    },
    { from: "2026-12-01", to: "2026-12-02", season: "2026/27", number: 2, members: [member("luna"), member("sam")] },
  ]);
});

it("never makes a wave of one Member's own Bugs, however close together", () => {
  const history = createHistory(
    [member("luna"), member("max")],
    [
      sick("luna", "2026-11-01", 2),
      healthy("luna", "2026-11-02"),
      sick("luna", "2026-11-03", 2), // her second Bug, a day later
      sick("luna", "2026-11-04", 2, [], true), // and a third, marked Neuer Infekt
      sick("max", "2026-11-20", 1), // far from all of them
    ],
  );

  expect(history.waves(seasonOf("2026-11-15"))).toEqual([]);
});

it("counts a wave crossing 31 Aug for the Season it started in", () => {
  const history = createHistory(
    [member("luna"), member("max"), member("oma", true)],
    [
      sick("luna", "2026-08-30", 2),
      sick("max", "2026-08-31", 2),
      sick("max", "2026-09-01", 3),
      sick("oma", "2026-09-03", 1), // archived Members' Bugs count too
    ],
  );

  expect(history.waves(seasonOf("2026-08-30"))).toEqual([
    {
      from: "2026-08-30",
      to: "2026-09-03",
      season: "2025/26",
      number: 1,
      members: [member("luna"), member("max"), member("oma", true)],
    },
  ]);
  expect(history.waves(seasonOf("2026-09-01"))).toEqual([]);
});

it("gives each Award to whoever did best in the Season; ties share it, and zero earns nothing", () => {
  const history = createHistory(
    [member("luna"), member("max"), member("sam")],
    [
      // Luna and Max had exactly the same Season, and caught their Bugs in one wave.
      ...["luna", "max"].flatMap((id) => [
        healthy(id, "2026-11-01"),
        healthy(id, "2026-11-02"),
        sick(id, "2026-11-03", 2, ["cough"]),
      ]),
      healthy("sam", "2026-11-05"), // one fit day: less than the others'
    ],
  );
  const [luna, max] = [member("luna"), member("max")];

  expect(history.awards(seasonOf("2026-11-15"))).toEqual([
    { award: { kind: "iron-defence", days: 2 }, members: [luna, max] },
    { award: { kind: "virus-collector", bugs: 1 }, members: [luna, max] },
    { award: { kind: "sofa-pro", days: 1 }, members: [luna, max] },
    // No Stehaufmännchen: nobody had two Bugs.
    { award: { kind: "bravery", severity: 2, days: 1 }, members: [luna, max] },
    { award: { kind: "season-opener", date: "2026-11-03" }, members: [luna, max] },
    { award: { kind: "wave-rider", waves: 1 }, members: [luna, max] },
    // Sam, never Sick, didn't win any of them.
    { award: { kind: "unbreakable" }, members: [member("sam")] },
  ]);

  // Nobody Sick at all: nothing for Sick days, Bugs or waves.
  const allFit = createHistory([member("luna"), member("max")], [healthy("luna", "2026-11-01"), healthy("max", "2026-11-01")]);
  expect(allFit.awards(seasonOf("2026-11-15"))).toEqual([{ award: { kind: "iron-defence", days: 1 }, members: [luna, max] }]);
});

it("gives Stehaufmännchen for the shortest Bugs on average, only among Members with at least two", () => {
  const history = createHistory(
    [member("luna"), member("max"), member("sam")],
    [
      // Luna: two Bugs of 1 and 2 days, 1.5 on average.
      sick("luna", "2026-11-01", 1),
      healthy("luna", "2026-11-02"),
      sick("luna", "2026-11-20", 1),
      sick("luna", "2026-11-21", 1),
      // Max: one Bug of a single day is shorter, but just one.
      sick("max", "2026-12-10", 1),
      // Sam: two Bugs of 2 days each.
      sick("sam", "2027-01-10", 1),
      sick("sam", "2027-01-11", 1),
      healthy("sam", "2027-01-12"),
      sick("sam", "2027-02-10", 1),
      sick("sam", "2027-02-11", 1),
    ],
  );

  const awards = history.awards(seasonOf("2026-11-15"));
  expect(awards.find(({ award }) => award.kind === "bounce-back")).toEqual({
    award: { kind: "bounce-back", days: 1.5 },
    members: [member("luna")],
  });
});

it("gives Tapferkeitsmedaille for the highest Severity, and among those for the most days at it", () => {
  const history = createHistory(
    [member("luna"), member("max"), member("sam")],
    [
      sick("luna", "2026-11-01", 4),
      sick("luna", "2026-11-02", 4),
      sick("max", "2026-12-01", 4),
      sick("max", "2026-12-02", 2),
      sick("max", "2026-12-03", 2),
      ...["2027-01-01", "2027-01-02", "2027-01-03"].map((date) => sick("sam", date, 3)),
    ],
  );

  const awards = history.awards(seasonOf("2026-11-15"));
  expect(awards.find(({ award }) => award.kind === "bravery")).toEqual({
    award: { kind: "bravery", severity: 4, days: 2 },
    members: [member("luna")],
  });
});

it("gives everyone with Check-ins in the Season at least one Award, and Members without none", () => {
  const history = createHistory(
    [member("luna"), member("max"), member("sam"), member("ben"), member("oma", true)],
    [
      // Luna wins all she can: fit longest, the most Bugs, Sick days and the worst ones, the first Bug.
      ...["2026-09-01", "2026-09-02", "2026-09-03"].map((date) => healthy("luna", date)),
      sick("luna", "2026-09-04", 5, ["fever"]),
      healthy("luna", "2026-09-05"),
      sick("luna", "2026-09-06", 5, ["fever"]),
      sick("luna", "2026-09-07", 5),
      // Max: a cough and a runny nose, one day each; the runny nose comes first in the catalog.
      sick("max", "2026-10-01", 1, ["cough"]),
      sick("max", "2026-10-02", 1, ["runny-nose"]),
      // Sam: Sick without a Symptom.
      sick("sam", "2026-10-20", 2),
      // Ben: fit, but not for as long as Luna.
      healthy("ben", "2026-10-25"),
      healthy("ben", "2026-10-26"),
      // Oma: only last Season.
      sick("oma", "2026-03-01", 3),
    ],
  );

  const luna = [member("luna")];
  expect(history.awards(seasonOf("2026-11-15"))).toEqual([
    { award: { kind: "iron-defence", days: 3 }, members: luna },
    { award: { kind: "virus-collector", bugs: 2 }, members: luna },
    { award: { kind: "sofa-pro", days: 3 }, members: luna },
    { award: { kind: "bounce-back", days: 1.5 }, members: luna },
    { award: { kind: "bravery", severity: 5, days: 3 }, members: luna },
    { award: { kind: "season-opener", date: "2026-09-04" }, members: luna },
    { award: { kind: "symptom-champion", symptom: "runny-nose", days: 1 }, members: [member("max")] },
    { award: { kind: "mystery" }, members: [member("sam")] },
    { award: { kind: "unbreakable" }, members: [member("ben")] },
  ]);
});
