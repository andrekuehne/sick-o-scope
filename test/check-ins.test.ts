import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import type { CheckIn, FillGapsResult } from "../src/shared/check-ins.ts";
import { addDays, utcToday } from "../src/shared/dates.ts";
import type { Member } from "../src/shared/members.ts";
import { api, json, signedIn } from "./helpers.ts";

const today = utcToday();
const yesterday = addDays(today, -1);

/** A signed-in User whose Family has the given Members. */
async function familyWith(...names: string[]) {
  const user = await signedIn();
  const members: Member[] = [];
  for (const name of names) {
    members.push(
      await json<Member>(
        api(`/api/families/${user.familyId}/members`, {
          method: "POST",
          body: { name, emoji: "🦊", colour: "#ff7a59" },
          cookie: user.cookie,
        }),
      ),
    );
  }
  return { ...user, members };
}

function saveCheckIn(cookie: string, familyId: string, date: string, memberId: string, state: object) {
  return api(`/api/families/${familyId}/check-ins/${date}/${memberId}`, { method: "PUT", body: state, cookie });
}

async function checkInsBetween(cookie: string, familyId: string, from: string, to: string) {
  return (await json<{ checkIns: CheckIn[] }>(api(`/api/families/${familyId}/check-ins?from=${from}&to=${to}`, { cookie })))
    .checkIns;
}

it("saves a Member's day as a complete state that replaces the previous one, including its Symptoms", async () => {
  const { cookie, familyId, members } = await familyWith("Luna");
  const luna = members[0]!.id;

  await saveCheckIn(cookie, familyId, today, luna, { status: "sick", severity: 3, symptoms: ["cough", "fever"] });
  expect(await checkInsBetween(cookie, familyId, today, today)).toMatchObject([
    { memberId: luna, date: today, status: "sick", severity: 3, symptoms: ["cough", "fever"], updatedBy: "André" },
  ]);

  // Saving again replaces the whole day: no Symptoms, no Severity left over.
  const res = await saveCheckIn(cookie, familyId, today, luna, { status: "healthy" });
  expect(res.status).toBe(200);
  expect(await checkInsBetween(cookie, familyId, today, today)).toEqual([
    expect.objectContaining({ memberId: luna, date: today, status: "healthy", note: null }),
  ]);
  const [only] = await checkInsBetween(cookie, familyId, today, today);
  expect(only).not.toHaveProperty("severity");
  expect(only).not.toHaveProperty("symptoms");

  // Deleting turns the day back into a Gap.
  const deleted = await api(`/api/families/${familyId}/check-ins/${today}/${luna}`, { method: "DELETE", cookie });
  expect(deleted.status).toBe(204);
  expect(await checkInsBetween(cookie, familyId, today, today)).toEqual([]);
});

it("rejects inconsistent days and impossible dates", async () => {
  const { cookie, familyId, members } = await familyWith("Luna");
  const luna = members[0]!.id;
  const save = (date: string, state: object) => saveCheckIn(cookie, familyId, date, luna, state);

  for (const state of [
    { status: "healthy", severity: 2 }, // Healthy has no Severity
    { status: "healthy", newBug: true }, // nor a Bug
    { status: "sick" }, // Sick needs one
    { status: "sick", severity: 6 },
    { status: "sick", severity: -1 },
    { status: "maybe" },
  ]) {
    expect((await save(today, state)).status).toBe(400);
  }
  expect((await save("2026-02-30", { status: "healthy" })).status).toBe(400);
  expect((await save(addDays(today, 2), { status: "healthy" })).status).toBe(400);
  // One day ahead of the server's UTC date is still someone's today.
  expect((await save(addDays(today, 1), { status: "healthy" })).status).toBe(200);
});

it("saves a Sick day at Severity 0, Fast gesund", async () => {
  const { cookie, familyId, members } = await familyWith("Luna");
  const luna = members[0]!.id;
  expect((await saveCheckIn(cookie, familyId, today, luna, { status: "sick", severity: 0, symptoms: ["runny-nose"] })).status).toBe(200);
  expect(await checkInsBetween(cookie, familyId, today, today)).toMatchObject([
    { status: "sick", severity: 0, symptoms: ["runny-nose"] },
  ]);
});

it("remembers a Sick day marked Neuer Infekt, and takes a day without the mark as continuing its Bug", async () => {
  const { cookie, familyId, members } = await familyWith("Luna");
  const luna = members[0]!.id;
  // An installed app from before Bugs sends no mark at all.
  await saveCheckIn(cookie, familyId, yesterday, luna, { status: "sick", severity: 1, symptoms: ["runny-nose"] });
  await saveCheckIn(cookie, familyId, today, luna, { status: "sick", severity: 3, symptoms: ["vomiting"], newBug: true });

  expect(await checkInsBetween(cookie, familyId, yesterday, today)).toMatchObject([
    { date: yesterday, newBug: false },
    { date: today, newBug: true },
  ]);

  // Saving the day again without the mark takes it away, like any other part of the day.
  await saveCheckIn(cookie, familyId, today, luna, { status: "sick", severity: 3, symptoms: ["vomiting"] });
  expect(await checkInsBetween(cookie, familyId, today, today)).toMatchObject([{ newBug: false }]);
});

it("fills only Gaps: an existing Check-in is never overwritten", async () => {
  const { cookie, familyId, members } = await familyWith("Luna", "Max");
  const [luna, max] = members.map((m) => m.id) as [string, string];
  await saveCheckIn(cookie, familyId, today, luna, { status: "sick", severity: 4, symptoms: ["fever"] });

  const res = await api(`/api/families/${familyId}/check-ins/fill-gaps`, {
    method: "POST",
    body: { checkIns: [luna, max].map((memberId) => ({ memberId, date: today, status: "healthy" })) },
    cookie,
  });
  expect(res.status).toBe(200);
  expect(await json<FillGapsResult>(res)).toEqual({
    written: [{ memberId: max, date: today }],
    skipped: [{ memberId: luna, date: today }],
  });

  const day = await checkInsBetween(cookie, familyId, today, today);
  expect(day.find((c) => c.memberId === luna)).toMatchObject({ status: "sick", severity: 4, symptoms: ["fever"] });
  expect(day.find((c) => c.memberId === max)).toMatchObject({ status: "healthy" });
});

it("keeps Families apart: another Family's Check-ins can't be read or written", async () => {
  const a = await familyWith("Luna");
  const b = await familyWith("Ben");
  const bMember = b.members[0]!.id;
  await saveCheckIn(b.cookie, b.familyId, yesterday, bMember, { status: "sick", severity: 2 });

  const fill = {
    method: "POST",
    body: { checkIns: [{ memberId: bMember, date: today, status: "healthy" }] },
    cookie: a.cookie,
  };
  const attempts = [
    // Through Family B's path…
    api(`/api/families/${b.familyId}/check-ins?from=${yesterday}&to=${today}`, { cookie: a.cookie }),
    saveCheckIn(a.cookie, b.familyId, today, bMember, { status: "healthy" }),
    api(`/api/families/${b.familyId}/check-ins/${yesterday}/${bMember}`, { method: "DELETE", cookie: a.cookie }),
    api(`/api/families/${b.familyId}/check-ins/fill-gaps`, fill),
    // …and with Family B's Member through Family A's own path.
    saveCheckIn(a.cookie, a.familyId, today, bMember, { status: "healthy" }),
    api(`/api/families/${a.familyId}/check-ins/${yesterday}/${bMember}`, { method: "DELETE", cookie: a.cookie }),
    api(`/api/families/${a.familyId}/check-ins/fill-gaps`, fill),
  ];
  for (const res of await Promise.all(attempts)) expect(res.status).toBe(404);

  // Family A sees none of it; Family B's day is untouched.
  expect(await checkInsBetween(a.cookie, a.familyId, yesterday, today)).toEqual([]);
  expect(await checkInsBetween(b.cookie, b.familyId, yesterday, today)).toEqual([
    expect.objectContaining({ memberId: bMember, date: yesterday, status: "sick", severity: 2 }),
  ]);
});

it("loads all of a Family's Check-ins at once, however far back, and only that Family's", async () => {
  const a = await familyWith("Luna");
  const b = await familyWith("Ben");
  const luna = a.members[0]!.id;
  const longAgo = addDays(today, -800); // further back than any date range may reach
  await saveCheckIn(a.cookie, a.familyId, longAgo, luna, { status: "sick", severity: 2 });
  await saveCheckIn(a.cookie, a.familyId, today, luna, { status: "healthy" });
  await saveCheckIn(b.cookie, b.familyId, today, b.members[0]!.id, { status: "healthy" });

  const all = await json<{ checkIns: CheckIn[] }>(api(`/api/families/${a.familyId}/check-ins/all`, { cookie: a.cookie }));
  expect(all.checkIns.map((c) => [c.memberId, c.date, c.status])).toEqual([
    [luna, longAgo, "sick"],
    [luna, today, "healthy"],
  ]);
  expect((await api(`/api/families/${b.familyId}/check-ins/all`, { cookie: a.cookie })).status).toBe(404);
});

it("has a database that refuses inconsistent days even if a bug got past the API", async () => {
  const { familyId, members } = await familyWith("Luna");
  const insert = (date: string, status: string, severity: number | null) =>
    env.DB.prepare(
      `INSERT INTO check_ins (id, family_id, member_id, date, status, severity, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'x', 'x')`,
    )
      .bind(crypto.randomUUID(), familyId, members[0]!.id, date, status, severity)
      .run();

  await expect(insert("2026-11-01", "sick", null)).rejects.toThrow(/CHECK/);
  await expect(insert("2026-11-02", "healthy", 2)).rejects.toThrow(/CHECK/);
  await expect(insert("2026-11-03", "sick", 6)).rejects.toThrow(/CHECK/);
  await expect(insert("2026-11-04", "sick", 2.5)).rejects.toThrow(/CHECK/);
  await expect(insert("2026-11-31", "healthy", null)).resolves.toBeTruthy(); // the API checks real dates
  await expect(
    env.DB.prepare(
      `INSERT INTO check_ins (id, family_id, member_id, date, status, new_bug, created_at, updated_at)
       VALUES (?, ?, ?, '2026-11-05', 'healthy', 1, 'x', 'x')`,
    )
      .bind(crypto.randomUUID(), familyId, members[0]!.id)
      .run(),
  ).rejects.toThrow(/CHECK/); // a Healthy day is never a new Bug
});

it("saves the Medications taken on a Sick day, and a new save replaces them", async () => {
  const { cookie, familyId, members } = await familyWith("Luna");
  const luna = members[0]!.id;

  await saveCheckIn(cookie, familyId, today, luna, { status: "sick", severity: 3, symptoms: ["fever"], medications: ["paracetamol", "nasal-spray"] });
  expect(await checkInsBetween(cookie, familyId, today, today)).toMatchObject([
    { status: "sick", symptoms: ["fever"], medications: ["nasal-spray", "paracetamol"] },
  ]);

  // Left out means none taken, like Symptoms.
  await saveCheckIn(cookie, familyId, today, luna, { status: "sick", severity: 2, symptoms: ["fever"] });
  expect(await checkInsBetween(cookie, familyId, today, today)).toMatchObject([{ status: "sick", medications: [] }]);

  await saveCheckIn(cookie, familyId, today, luna, { status: "sick", severity: 2, medications: ["antibiotics"] });
  await saveCheckIn(cookie, familyId, today, luna, { status: "healthy" });
  const [day] = await checkInsBetween(cookie, familyId, today, today);
  expect(day).not.toHaveProperty("medications");

  // Back to Sick: the Healthy save left nothing behind.
  await saveCheckIn(cookie, familyId, today, luna, { status: "sick", severity: 1 });
  expect(await checkInsBetween(cookie, familyId, today, today)).toMatchObject([{ medications: [] }]);
});

it("rejects Medications on a Healthy day, unknown ones, and the same one twice", async () => {
  const { cookie, familyId, members } = await familyWith("Luna");
  const luna = members[0]!.id;
  const fillGaps = (checkIns: object[]) =>
    api(`/api/families/${familyId}/check-ins/fill-gaps`, { method: "POST", body: { checkIns }, cookie });

  expect((await saveCheckIn(cookie, familyId, today, luna, { status: "healthy", medications: ["ibuprofen"] })).status).toBe(400);
  expect((await saveCheckIn(cookie, familyId, today, luna, { status: "sick", severity: 2, medications: ["aspirin"] })).status).toBe(400);
  expect((await saveCheckIn(cookie, familyId, today, luna, { status: "sick", severity: 2, medications: ["ibuprofen", "ibuprofen"] })).status).toBe(400);
  expect((await fillGaps([{ memberId: luna, date: today, status: "sick", severity: 2, medications: ["aspirin"] }])).status).toBe(400);
  expect(await checkInsBetween(cookie, familyId, today, today)).toEqual([]);
});

it("answers bad input with 400, never a server error: repeated Symptoms, mixed-up gap fills", async () => {
  const { cookie, familyId, members } = await familyWith("Luna");
  const luna = members[0]!.id;
  const fillGaps = (checkIns: object[]) =>
    api(`/api/families/${familyId}/check-ins/fill-gaps`, { method: "POST", body: { checkIns }, cookie });

  expect((await saveCheckIn(cookie, familyId, today, luna, { status: "sick", severity: 2, symptoms: ["cough", "cough"] })).status).toBe(400);
  // Only Symptoms from the fixed catalog, on a single day and in gap fills alike.
  expect((await saveCheckIn(cookie, familyId, today, luna, { status: "sick", severity: 2, symptoms: ["cough", "zombie-bite"] })).status).toBe(400);
  expect((await fillGaps([{ memberId: luna, date: today, status: "sick", severity: 2, symptoms: ["zombie-bite"] }])).status).toBe(400);
  // fill-gaps is as strict as saving a single day.
  expect((await fillGaps([{ memberId: luna, date: today, status: "healthy", severity: 2 }])).status).toBe(400);
  expect((await fillGaps([{ memberId: luna, date: today, status: "healthy", surprise: true }])).status).toBe(400);
  expect(await checkInsBetween(cookie, familyId, today, today)).toEqual([]);
});

it("fills a long stretch of Gaps for the whole Family in one go", async () => {
  const { cookie, familyId, members } = await familyWith("Luna", "Max", "Oma", "Ben", "Mia", "Tom");
  const days = Array.from({ length: 15 }, (_, i) => addDays(today, -i));
  const checkIns = members.flatMap((m) =>
    days.map((date) => ({ memberId: m.id, date, status: "sick", severity: 2, symptoms: ["cough", "fever"], medications: ["cough-syrup"] })),
  );

  const res = await api(`/api/families/${familyId}/check-ins/fill-gaps`, { method: "POST", body: { checkIns }, cookie });
  expect(res.status).toBe(200);
  expect((await json<FillGapsResult>(res)).written).toHaveLength(90);
  const saved = await checkInsBetween(cookie, familyId, days.at(-1)!, today);
  expect(saved).toHaveLength(90);
  expect(saved.every((c) => c.status === "sick" && c.symptoms.join() === "cough,fever" && c.medications.join() === "cough-syrup")).toBe(true);
});
