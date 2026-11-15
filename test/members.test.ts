import { expect, it } from "vitest";
import type { Me } from "../src/shared/auth.ts";
import type { Member } from "../src/shared/members.ts";
import { api, json, signedIn } from "./helpers.ts";

const luna = { name: "Luna", emoji: "🦊", colour: "#ff7a59" };
const max = { name: "Max", emoji: "🐻", colour: "#4a90d9" };

function addMember(cookie: string, familyId: string, member: object) {
  return api(`/api/families/${familyId}/members`, { method: "POST", body: member, cookie });
}

it("adds Members to the Family, in order, and shows them in /api/me", async () => {
  const { cookie, familyId } = await signedIn();

  const created = await addMember(cookie, familyId, luna);
  expect(created.status).toBe(201);
  expect(await created.json()).toMatchObject({ ...luna, archived: false });
  await addMember(cookie, familyId, max);

  const me = await json<Me>(api("/api/me", { cookie }));
  expect(me.members.map((m) => m.name)).toEqual(["Luna", "Max"]);
});

it("keeps Families apart: another Family's Members can't be listed, added, edited or archived", async () => {
  const a = await signedIn({ familyName: "Familie A", userName: "Anna" });
  const b = await signedIn({ familyName: "Familie B", userName: "Ben" });
  const bMember = await json<Member>(addMember(b.cookie, b.familyId, luna));

  // Anna, signed in to Family A, aims at Family B's path…
  const onB = `/api/families/${b.familyId}/members`;
  const attempts = [
    api(onB, { cookie: a.cookie }),
    addMember(a.cookie, b.familyId, max),
    api(`${onB}/${bMember.id}`, { method: "PUT", body: max, cookie: a.cookie }),
    api(`${onB}/${bMember.id}/archive`, { method: "POST", cookie: a.cookie }),
    api(`${onB}/${bMember.id}/unarchive`, { method: "POST", cookie: a.cookie }),
    api(`${onB}/order`, { method: "PUT", body: { memberIds: [bMember.id] }, cookie: a.cookie }),
    // …and at Family B's Member through her own Family's path.
    api(`/api/families/${a.familyId}/members/${bMember.id}`, { method: "PUT", body: max, cookie: a.cookie }),
    api(`/api/families/${a.familyId}/members/${bMember.id}/archive`, { method: "POST", cookie: a.cookie }),
    api(`/api/families/${a.familyId}/members/order`, {
      method: "PUT",
      body: { memberIds: [bMember.id] },
      cookie: a.cookie,
    }),
    // A guessed Family id looks just the same.
    api(`/api/families/${crypto.randomUUID()}/members`, { cookie: a.cookie }),
  ];
  for (const res of await Promise.all(attempts)) {
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  }

  // Family B is untouched.
  const bList = await json<{ members: Member[] }>(api(onB, { cookie: b.cookie }));
  expect(bList.members).toEqual([{ ...luna, id: bMember.id, archived: false }]);
});

it("needs a signed-in User for Family routes", async () => {
  const { familyId } = await signedIn();
  expect((await api(`/api/families/${familyId}/members`)).status).toBe(401);
});

it("reorders Members, and archives one without losing it", async () => {
  const { cookie, familyId } = await signedIn();
  const base = `/api/families/${familyId}/members`;
  const l = await json<Member>(addMember(cookie, familyId, luna));
  const m = await json<Member>(addMember(cookie, familyId, max));
  const names = async () =>
    (await json<{ members: Member[] }>(api(base, { cookie }))).members.map(
      (x) => `${x.name}${x.archived ? " (archiviert)" : ""}`,
    );

  expect((await api(`${base}/order`, { method: "PUT", body: { memberIds: [m.id, l.id] }, cookie })).status).toBe(200);
  expect(await names()).toEqual(["Max", "Luna"]);

  // A reorder must name every active Member exactly once.
  const partial = await api(`${base}/order`, { method: "PUT", body: { memberIds: [l.id] }, cookie });
  expect(partial.status).toBe(400);
  expect(await names()).toEqual(["Max", "Luna"]);

  await api(`${base}/${m.id}/archive`, { method: "POST", cookie });
  expect(await names()).toEqual(["Luna", "Max (archiviert)"]);

  await api(`${base}/${m.id}/unarchive`, { method: "POST", cookie });
  expect(await names()).toEqual(["Luna", "Max"]);
});

it("rejects Members without a name, without exactly one emoji, or without a valid colour", async () => {
  const { cookie, familyId } = await signedIn();
  for (const invalid of [
    { ...luna, name: "   " },
    { ...luna, emoji: "abc" },
    { ...luna, emoji: "🦊🐻" },
    { ...luna, colour: "red" },
  ]) {
    expect((await addMember(cookie, familyId, invalid)).status).toBe(400);
  }
  // A family emoji made of several code points still counts as one.
  expect((await addMember(cookie, familyId, { ...luna, emoji: "👩‍👧" })).status).toBe(201);
});
