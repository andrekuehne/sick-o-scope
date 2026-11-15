import { expect, it } from "vitest";
import type { CheckIn } from "../src/shared/check-ins.ts";
import { createHistory } from "../src/shared/history.ts";
import type { Member } from "../src/shared/members.ts";

const member = (id: string, archived = false): Member => ({ id, name: id, emoji: "🦊", colour: "#ff7a59", archived });
const healthy = (memberId: string, date: string): CheckIn => ({
  memberId,
  date,
  status: "healthy",
  note: null,
  updatedBy: "André",
  updatedAt: "2026-11-15T08:00:00.000Z",
});
const sick = (memberId: string, date: string, severity: 1 | 2 | 3 | 4 | 5, symptoms: string[] = []): CheckIn => ({
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
