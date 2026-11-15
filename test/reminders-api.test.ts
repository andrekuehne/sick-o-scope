import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import type { Member } from "../src/shared/members.ts";
import type { ReminderInput, ThisDeviceReminder } from "../src/shared/reminders.ts";
import type { FamilyUsers, SignInLinkCreated } from "../src/shared/users.ts";
import { type PushOutcome, sendDueReminders } from "../src/worker/reminders/reminder-job.ts";
import { api, json, redeem, sessionCookieFrom, signedIn } from "./helpers.ts";

const reminderPath = (familyId: string) => `/api/families/${familyId}/reminder`;

/** What the app sends when Erinnerung is switched on: the time, the phone's timezone, its push subscription. */
const reminderAt = (time: string, endpoint = `https://fcm.googleapis.com/fcm/send/${crypto.randomUUID()}`): ReminderInput => ({
  time,
  timeZone: "Europe/Berlin",
  subscription: { endpoint, keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } },
});

const getReminder = (familyId: string, cookie: string) => json<ThisDeviceReminder>(api(reminderPath(familyId), { cookie }));
const putReminder = (familyId: string, cookie: string, body: unknown) =>
  api(reminderPath(familyId), { method: "PUT", body, cookie });

/** A signed-in Family with one Member, so its days aren't done until someone logs. */
async function familyWithMember() {
  const family = await signedIn();
  const res = await api(`/api/families/${family.familyId}/members`, {
    method: "POST",
    body: { name: "Luna", emoji: "🦊", colour: "#ff7a59" },
    cookie: family.cookie,
  });
  expect(res.status).toBe(201);
  return { ...family, member: await json<Member>(res) };
}

/** A second Device for the same User, via Gerät hinzufügen. */
async function anotherDevice(familyId: string, userId: string, cookie: string) {
  const res = await api(`/api/families/${familyId}/sign-in-links`, { method: "POST", body: { forUserId: userId }, cookie });
  const link = await json<SignInLinkCreated>(res);
  return sessionCookieFrom(await redeem(new URL(link.url).hash.slice(1)));
}

/**
 * Runs the scheduled job with a stand-in push service that answers `outcome`. Returns which
 * of `endpoints` were pushed to (the database also holds other tests' Reminders).
 */
async function runJob(now: string, endpoints: string[], outcome: (endpoint: string) => PushOutcome = () => "sent") {
  const pushed: string[] = [];
  await sendDueReminders(env.DB, new Date(now), async (endpoint) => {
    pushed.push(endpoint);
    return outcome(endpoint);
  });
  return endpoints.filter((e) => pushed.includes(e));
}

// 20:00 in Berlin on 2026-11-10.
const AT_20_00 = "2026-11-10T19:00:00Z";

it("saves, changes and switches off this Device's Reminder", async () => {
  const andre = await familyWithMember();
  const before = await getReminder(andre.familyId, andre.cookie);
  expect(before).toEqual({ reminder: null, vapidPublicKey: expect.stringMatching(/^[A-Za-z0-9_-]{87}$/) });

  expect((await putReminder(andre.familyId, andre.cookie, reminderAt("20:00"))).status).toBe(200);
  expect((await getReminder(andre.familyId, andre.cookie)).reminder).toEqual({ time: "20:00" });

  expect((await putReminder(andre.familyId, andre.cookie, reminderAt("21:45"))).status).toBe(200);
  expect((await getReminder(andre.familyId, andre.cookie)).reminder).toEqual({ time: "21:45" });

  // Only quarter hours, real timezones and push services.
  const invalid = [
    reminderAt("20:10"),
    { ...reminderAt("20:00"), timeZone: "Mars/Olympus" },
    reminderAt("20:00", "https://attacker.example/collect"),
  ];
  for (const body of invalid) expect((await putReminder(andre.familyId, andre.cookie, body)).status).toBe(400);

  const off = await api(reminderPath(andre.familyId), { method: "DELETE", cookie: andre.cookie });
  expect(off.status).toBe(204);
  expect((await getReminder(andre.familyId, andre.cookie)).reminder).toBeNull();
});

it("keeps each Device's Reminder to itself, and no other Family reaches it", async () => {
  const andre = await familyWithMember();
  const andresTablet = await anotherDevice(andre.familyId, andre.userId, andre.cookie);
  const other = await signedIn({ familyName: "Familie Meier", userName: "Jana" });
  await putReminder(andre.familyId, andre.cookie, reminderAt("20:00"));

  expect((await getReminder(andre.familyId, andresTablet)).reminder).toBeNull();
  expect((await api(reminderPath(andre.familyId), { cookie: other.cookie })).status).toBe(404);
  expect((await putReminder(andre.familyId, other.cookie, reminderAt("20:00"))).status).toBe(404);
  expect((await api(reminderPath(andre.familyId), { method: "DELETE", cookie: other.cookie })).status).toBe(404);
});

it("sends a due Reminder once, not when the day is done, and drops it when the push service says it's gone", async () => {
  const andre = await familyWithMember();
  const done = await familyWithMember();
  const gone = await familyWithMember();
  const [andresPhone, doneFamilysPhone, gonePhone] = [reminderAt("20:00"), reminderAt("20:00"), reminderAt("20:00")];
  await putReminder(andre.familyId, andre.cookie, andresPhone);
  await putReminder(done.familyId, done.cookie, doneFamilysPhone);
  await putReminder(gone.familyId, gone.cookie, gonePhone);
  const endpoints = [andresPhone, doneFamilysPhone, gonePhone].map((r) => r.subscription.endpoint);
  const logged = await api(`/api/families/${done.familyId}/check-ins/2026-11-10/${done.member.id}`, {
    method: "PUT",
    body: { status: "healthy", note: null },
    cookie: done.cookie,
  });
  expect(logged.status).toBe(200);

  const pushed = await runJob(AT_20_00, endpoints, (e) => (e === gonePhone.subscription.endpoint ? "gone" : "sent"));

  expect(pushed).toEqual([andresPhone.subscription.endpoint, gonePhone.subscription.endpoint]);
  // Five minutes later, the same quarter hour: nothing again.
  expect(await runJob("2026-11-10T19:05:00Z", endpoints)).toEqual([]);
  expect((await getReminder(gone.familyId, gone.cookie)).reminder).toBeNull();
  expect((await getReminder(andre.familyId, andre.cookie)).reminder).toEqual({ time: "20:00" });
});

it("drops the Reminders of a signed-out Device and of a removed User", async () => {
  const andre = await familyWithMember();
  const andresTablet = await anotherDevice(andre.familyId, andre.userId, andre.cookie);
  const janaLink = await json<SignInLinkCreated>(
    api(`/api/families/${andre.familyId}/sign-in-links`, { method: "POST", body: { newUserName: "Jana" }, cookie: andre.cookie }),
  );
  const jana = sessionCookieFrom(await redeem(new URL(janaLink.url).hash.slice(1)));
  const [phone, tablet, janasPhone, ownPhone] = [reminderAt("20:00"), reminderAt("20:00"), reminderAt("20:00"), reminderAt("20:00")];
  await putReminder(andre.familyId, andre.cookie, phone);
  await putReminder(andre.familyId, andresTablet, tablet);
  await putReminder(andre.familyId, jana, janasPhone);

  const { users } = await json<FamilyUsers>(api(`/api/families/${andre.familyId}/users`, { cookie: andre.cookie }));
  const tabletDevice = users[0]!.devices.find((d) => !d.isThisDevice)!;
  await api(`/api/families/${andre.familyId}/devices/${tabletDevice.id}`, { method: "DELETE", cookie: andre.cookie });
  await api(`/api/families/${andre.familyId}/users/${users[1]!.id}`, { method: "DELETE", cookie: andre.cookie });
  // Signing out from the phone itself.
  const signingOut = await anotherDevice(andre.familyId, andre.userId, andre.cookie);
  await putReminder(andre.familyId, signingOut, ownPhone);
  await api("/api/sign-out", { method: "POST", cookie: signingOut });

  const all = [phone, tablet, janasPhone, ownPhone].map((r) => r.subscription.endpoint);
  expect(await runJob(AT_20_00, all)).toEqual([phone.subscription.endpoint]);
});
