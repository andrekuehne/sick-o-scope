import { env, exports } from "cloudflare:workers";
import { createSignInLink } from "../src/worker/auth/sign-in-links.ts";
import { createFamilyWithFirstUser } from "../src/worker/family-setup.ts";

const ORIGIN = "https://sick-o-scope.test";

/**
 * Calls the Worker the way the app does: JSON in, an optional session cookie, and the
 * same-origin `Origin` header a browser sends with every POST.
 */
export async function api(path: string, init: { method?: string; body?: unknown; cookie?: string } = {}) {
  const headers = new Headers();
  if ((init.method ?? "GET") !== "GET") headers.set("origin", ORIGIN);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (init.cookie) headers.set("cookie", init.cookie);
  return exports.default.fetch(
    new Request(`${ORIGIN}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
  );
}

/** The session cookie a response sets, ready to send back as a `cookie` header. */
export function sessionCookieFrom(res: Response): string {
  const setCookie = res.headers.get("set-cookie") ?? "";
  const pair = setCookie.split(";")[0] ?? "";
  if (!pair.includes("=") || pair.endsWith("=")) throw new Error(`no session cookie set: "${setCookie}"`);
  return pair;
}

/** A Family with its first User and a fresh Sign-in link, made with the setup command's code. */
export async function newFamily(names = { familyName: "Familie Kühne", userName: "André" }, now = new Date()) {
  const { familyId, userId } = await createFamilyWithFirstUser(env.DB, names, now);
  const link = await createSignInLink(env.DB, { familyId, forUserId: userId }, now);
  if (!link) throw new Error("no Sign-in link");
  return { familyId, userId, token: link.token };
}

/** Redeems a Sign-in link like the Anmelden button does. */
export function redeem(token: string, cookie?: string) {
  return api("/api/sign-in", { method: "POST", body: { token }, cookie });
}

/** A signed-in Device of a new Family's first User. */
export async function signedIn(names?: { familyName: string; userName: string }) {
  const family = await newFamily(names);
  const res = await redeem(family.token);
  if (res.status !== 200) throw new Error(`sign-in failed: ${res.status} ${await res.text()}`);
  return { ...family, cookie: sessionCookieFrom(res) };
}

/** A response's JSON body, typed by the caller (the Workers types make it `unknown`). */
export async function json<T>(res: Response | Promise<Response>): Promise<T> {
  return (await (await res).json()) as T;
}
