import { expect, it } from "vitest";
import type { CheckIn } from "../src/shared/check-ins.ts";
import { addDays } from "../src/shared/dates.ts";
import { createHistory } from "../src/shared/history.ts";
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
const sick = (memberId: string, date: string, severity: 1 | 2 | 3 | 4 | 5, symptoms: SymptomKey[] = []): CheckIn => ({
  ...healthy(memberId, date),
  status: "sick",
  severity,
  symptoms,
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

it("counts a Member's current Streak across a month boundary, and a Gap ends it", () => {
  const history = createHistory(
    [member("luna")],
    [
      sick("luna", "2026-10-27", 2), // before the Gap: not part of the current Streak
      sick("luna", "2026-10-29", 2),
      sick("luna", "2026-10-30", 3),
      sick("luna", "2026-10-31", 4),
      sick("luna", "2026-11-01", 2),
      healthy("luna", "2026-11-02"),
      healthy("luna", "2026-11-03"),
      sick("luna", "2026-11-04", 1), // only "Naja", but any Sick day breaks a Healthy Streak
      healthy("luna", "2026-11-05"),
    ],
  );

  expect(history.memberStreak("luna", "2026-11-01")).toEqual({ kind: "sick", from: "2026-10-29", days: 4 });
  expect(history.memberStreak("luna", "2026-11-03")).toEqual({ kind: "healthy", from: "2026-11-02", days: 2 });
  expect(history.memberStreak("luna", "2026-11-05")).toEqual({ kind: "healthy", from: "2026-11-05", days: 1 });
  expect(history.memberStreak("luna", "2026-11-06")).toBeNull();
});

it("turns Besser at Severity 1 into a Healthy day and caps Schlechter at 5, keeping the Symptoms", () => {
  const history = createHistory(
    [member("luna"), member("max"), member("oma")],
    [sick("luna", "2026-11-14", 1, ["cough"]), sick("max", "2026-11-14", 5, ["fever", "cough"]), sick("oma", "2026-11-14", 3, ["fever"])],
  );
  const shortcut = history.shortcut;

  expect(shortcut("better", "luna", "2026-11-15")).toEqual({ status: "healthy", note: null });
  expect(shortcut("worse", "max", "2026-11-15")).toEqual({ status: "sick", severity: 5, symptoms: ["fever", "cough"], note: null });
  expect(shortcut("better", "oma", "2026-11-15")).toEqual({ status: "sick", severity: 2, symptoms: ["fever"], note: null });
  expect(shortcut("worse", "oma", "2026-11-15")).toEqual({ status: "sick", severity: 4, symptoms: ["fever"], note: null });
  expect(shortcut("same", "oma", "2026-11-15")).toEqual({ status: "sick", severity: 3, symptoms: ["fever"], note: null });
});

it("offers Wie gestern only after a logged day, without the note, and Gleich/Besser/Schlechter only after a Sick day", () => {
  const history = createHistory(
    [member("luna"), member("max"), member("ben")],
    [
      { ...sick("luna", "2026-11-14", 3, ["cough"]), note: "Fieber nachts 39,2" },
      healthy("max", "2026-11-14"),
      healthy("ben", "2026-11-13"), // then a Gap on the 14th
    ],
  );

  expect(history.shortcut("like-yesterday", "luna", "2026-11-15")).toEqual({
    status: "sick",
    severity: 3,
    symptoms: ["cough"],
    note: null,
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
      { ...sick("luna", "2026-11-10", 2, ["cough"]), note: "beim Arzt" },
      healthy("luna", "2026-11-15"), // today's already logged; the missed days still count
      ...healthyDays(["max"], "2026-11-08", "2026-11-14"),
    ],
  );

  expect(history.gapProposals("2026-11-15")).toEqual([
    {
      from: "2026-11-11",
      to: "2026-11-14",
      days: 4,
      members: [{ member: member("luna"), last: { status: "sick", severity: 2, symptoms: ["cough"], note: null } }],
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
        { member: member("max"), last: { status: "sick", severity: 3, symptoms: [], note: null } },
        { member: member("lia"), last: { status: "healthy", note: null } },
      ],
    },
  ]);
  expect(createHistory([member("luna")], [healthy("luna", "2026-11-14")]).gapProposals("2026-11-15")).toEqual([]);
});
