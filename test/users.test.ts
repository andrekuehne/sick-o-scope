import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import type { FamilyUsers, SignInLinkCreated, SignInLinkRequest } from "../src/shared/users.ts";
import { api, json, redeem, sessionCookieFrom, signedIn } from "./helpers.ts";

/** Gerät hinzufügen: a Sign-in link from inside the app, redeemed on another Device. */
async function addDevice(familyId: string, cookie: string, forWhom: SignInLinkRequest) {
  const res = await api(`/api/families/${familyId}/sign-in-links`, { method: "POST", body: forWhom, cookie });
  expect(res.status).toBe(201);
  const link = await json<SignInLinkCreated>(res);
  const token = new URL(link.url).hash.slice(1);
  const redeemed = await redeem(token);
  expect(redeemed.status).toBe(200);
  return { link, token, cookie: sessionCookieFrom(redeemed) };
}

it("adds a new User to the Family with a Sign-in link: the User is created on redemption", async () => {
  const andre = await signedIn();

  const { link, token, cookie } = await addDevice(andre.familyId, andre.cookie, { newUserName: "Jana" });

  expect(link.url).toMatch(/^https:\/\/sick-o-scope\.test\/anmelden#[A-Za-z0-9_-]{43}$/);
  expect(await json(api("/api/me", { cookie }))).toMatchObject({ user: { name: "Jana" }, family: { id: andre.familyId } });
  // The raw token is only ever in that one answer: the database has its hash, nothing else.
  const stored = await env.DB.prepare("SELECT token_hash FROM sign_in_links WHERE token_hash = ? OR token_hash LIKE ?")
    .bind(token, `%${token}%`)
    .all();
  expect(stored.results).toEqual([]);
});

it("lists the Family's Users with their Devices, and any User can sign out any Device: it loses access at once", async () => {
  const andre = await signedIn();
  const andresNewPhone = await addDevice(andre.familyId, andre.cookie, { forUserId: andre.userId });
  const jana = await addDevice(andre.familyId, andre.cookie, { newUserName: "Jana" });

  const { users } = await json<FamilyUsers>(api(`/api/families/${andre.familyId}/users`, { cookie: jana.cookie }));
  expect(users.map((u) => [u.name, u.isMe, u.devices.length])).toEqual([
    ["André", false, 2],
    ["Jana", true, 1],
  ]);
  expect(users[1]?.devices[0]).toMatchObject({ isThisDevice: true, label: expect.any(String), lastSeenAt: expect.any(String) });

  // Jana signs out one of André's two phones; the new one is André's too.
  const phone = users[0]!.devices[0]!;
  const meOnPhone = await json<{ user: { id: string } }>(api("/api/me", { cookie: andresNewPhone.cookie }));
  expect(meOnPhone.user.id).toBe(andre.userId);
  const out = await api(`/api/families/${andre.familyId}/devices/${phone.id}`, { method: "DELETE", cookie: jana.cookie });
  expect(out.status).toBe(204);

  const stillIn = [andre.cookie, andresNewPhone.cookie].map((cookie) => api("/api/me", { cookie }).then((r) => r.status));
  expect((await Promise.all(stillIn)).sort()).toEqual([200, 401]);
});

it("removes a User: all of their Devices lose access, and their Check-ins still say who saved them", async () => {
  const andre = await signedIn();
  const jana = await addDevice(andre.familyId, andre.cookie, { newUserName: "Jana" });
  const janasTablet = await addDevice(andre.familyId, andre.cookie, {
    forUserId: (await json<{ user: { id: string } }>(api("/api/me", { cookie: jana.cookie }))).user.id,
  });
  const janaId = (await json<{ user: { id: string } }>(api("/api/me", { cookie: janasTablet.cookie }))).user.id;
  const luna = await json<{ id: string }>(
    api(`/api/families/${andre.familyId}/members`, { method: "POST", body: { name: "Luna", emoji: "🦊", colour: "#ff7a59" }, cookie: andre.cookie }),
  );
  const checkIn = `/api/families/${andre.familyId}/check-ins/2026-11-14/${luna.id}`;
  expect((await api(checkIn, { method: "PUT", body: { status: "healthy" }, cookie: jana.cookie })).status).toBe(200);

  const removed = await api(`/api/families/${andre.familyId}/users/${janaId}`, { method: "DELETE", cookie: andre.cookie });
  expect(removed.status).toBe(204);

  for (const cookie of [jana.cookie, janasTablet.cookie]) expect((await api("/api/me", { cookie })).status).toBe(401);
  const { users } = await json<FamilyUsers>(api(`/api/families/${andre.familyId}/users`, { cookie: andre.cookie }));
  expect(users.map((u) => u.name)).toEqual(["André"]);
  const days = await json<{ checkIns: { updatedBy: string | null }[] }>(
    api(`/api/families/${andre.familyId}/check-ins?from=2026-11-14&to=2026-11-14`, { cookie: andre.cookie }),
  );
  expect(days.checkIns).toMatchObject([{ status: "healthy", updatedBy: "Jana" }]);
});

it("keeps the last User: a Family can't lock itself out", async () => {
  const andre = await signedIn();
  const res = await api(`/api/families/${andre.familyId}/users/${andre.userId}`, { method: "DELETE", cookie: andre.cookie });
  expect(res.status).toBe(409);
  expect((await api("/api/me", { cookie: andre.cookie })).status).toBe(200);
});

it("keeps Families apart: a User of Family B can't see or manage Family A's Users and Devices", async () => {
  const a = await signedIn({ familyName: "Familie A", userName: "Anna" });
  const b = await signedIn({ familyName: "Familie B", userName: "Bert" });
  const [annasDevice] = (await json<FamilyUsers>(api(`/api/families/${a.familyId}/users`, { cookie: a.cookie }))).users[0]!.devices;

  const attempts = [
    api(`/api/families/${a.familyId}/users`, { cookie: b.cookie }),
    api(`/api/families/${a.familyId}/sign-in-links`, { method: "POST", body: { newUserName: "Mallory" }, cookie: b.cookie }),
    // Through B's own Family, with A's ids: still nothing.
    api(`/api/families/${b.familyId}/sign-in-links`, { method: "POST", body: { forUserId: a.userId }, cookie: b.cookie }),
    api(`/api/families/${b.familyId}/devices/${annasDevice!.id}`, { method: "DELETE", cookie: b.cookie }),
    api(`/api/families/${b.familyId}/users/${a.userId}`, { method: "DELETE", cookie: b.cookie }),
  ];
  for (const res of await Promise.all(attempts)) expect(res.status).toBe(404);

  expect((await api("/api/me", { cookie: a.cookie })).status).toBe(200);
  const { users } = await json<FamilyUsers>(api(`/api/families/${a.familyId}/users`, { cookie: a.cookie }));
  expect(users.map((u) => [u.name, u.devices.length])).toEqual([["Anna", 1]]);
});
