import { exports } from "cloudflare:workers";
import { expect, it, vi } from "vitest";
import { api, newFamily, redeem, sessionCookieFrom, signedIn } from "./helpers.ts";

it("signs a Device in with a Sign-in link and greets its User", async () => {
  const { token } = await newFamily({ familyName: "Familie Kühne", userName: "André" });

  const res = await redeem(token);
  expect(res.status).toBe(200);

  const me = await api("/api/me", { cookie: sessionCookieFrom(res) });
  expect(me.status).toBe(200);
  expect(await me.json()).toMatchObject({ user: { name: "André" }, family: { name: "Familie Kühne" } });
});

it("lets a Sign-in link sign in only one Device", async () => {
  const { token } = await newFamily();
  expect((await redeem(token)).status).toBe(200);

  const again = await redeem(token);
  expect(again.status).toBe(410);
  expect(await again.json()).toEqual({ error: "used" });
  expect(again.headers.get("set-cookie")).toBeNull();
});

it("rejects a Sign-in link older than 24 hours", async () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000 - 1000);
  const { token } = await newFamily(undefined, yesterday);

  const res = await redeem(token);
  expect(res.status).toBe(410);
  expect(await res.json()).toEqual({ error: "expired" });
});

it("never redeems a Sign-in link through a GET", async () => {
  const { token } = await newFamily();

  const viaGet = await api(`/api/sign-in?token=${token}`);
  expect(viaGet.status).toBe(404);
  expect(viaGet.headers.get("set-cookie")).toBeNull();

  // The link is still unused afterwards.
  expect((await redeem(token)).status).toBe(200);
});

it("rejects tokens that were never issued", async () => {
  const res = await redeem("x".repeat(43));
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "unknown" });
});

it("signs a Device out: its session no longer works", async () => {
  const { cookie } = await signedIn();
  expect((await api("/api/me", { cookie })).status).toBe(200);

  const out = await api("/api/sign-out", { method: "POST", cookie });
  expect(out.status).toBe(204);

  const me = await api("/api/me", { cookie });
  expect(me.status).toBe(401);
  expect(await me.json()).toEqual({ error: "signed_out" });
});

it("keeps a Device signed in while it is used, and signs it out after a year without use", async () => {
  const DAY = 24 * 60 * 60 * 1000;
  const start = Date.now();
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    const { cookie } = await signedIn();

    // Used now and then: still signed in well over a year after signing in.
    vi.setSystemTime(start + 300 * DAY);
    expect((await api("/api/me", { cookie })).status).toBe(200);
    vi.setSystemTime(start + 600 * DAY);
    expect((await api("/api/me", { cookie })).status).toBe(200);

    // Then a year and a day without use.
    vi.setSystemTime(start + 966 * DAY);
    expect((await api("/api/me", { cookie })).status).toBe(401);
  } finally {
    vi.useRealTimers();
  }
});

it("refuses sign-ins from other sites (login CSRF), leaving the link unused", async () => {
  const { token } = await newFamily();
  // A cross-site form can post a text/plain body that happens to parse as JSON.
  const forged = await exports.default.fetch(
    new Request("https://sick-o-scope.test/api/sign-in", {
      method: "POST",
      headers: { "content-type": "text/plain", origin: "https://evil.example" },
      body: JSON.stringify({ token }),
    }),
  );
  expect(forged.status).toBe(403);
  expect(forged.headers.get("set-cookie")).toBeNull();

  expect((await redeem(token)).status).toBe(200);
});
