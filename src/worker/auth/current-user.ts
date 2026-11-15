import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { CookieOptions } from "hono/utils/cookie";
import type { AppEnv } from "../app-env.ts";
import { signedInDevice } from "./devices.ts";

/**
 * The session cookie holds this Device's raw session token. Its `__Host-` prefix
 * makes browsers insist on Secure, Path=/ and no Domain, so no subdomain can set it.
 */
const SESSION_COOKIE = "sos_session";
const COOKIE_OPTIONS: CookieOptions = { httpOnly: true, secure: true, sameSite: "Lax", path: "/", prefix: "host" };

export type SignedInUser = { userId: string; deviceId: string };

/**
 * Who is signed in on this request's Device, or null. The single boundary for identity
 * (ADR 0002): every route that needs a User gets it from here, via `requireUser`.
 * Renews the Device's sign-in (and its cookie) while the Device is in use.
 */
export async function currentUser(c: Context<AppEnv>): Promise<SignedInUser | null> {
  const token = sessionTokenFrom(c);
  if (!token) return null;
  const device = await signedInDevice(c.env.DB, token, new Date());
  if (!device) {
    // A signed-out or expired Device: drop its useless cookie.
    clearSessionCookie(c);
    return null;
  }
  if (device.renewedUntil) setSessionCookie(c, token, device.renewedUntil);
  return { userId: device.userId, deviceId: device.deviceId };
}

/** Lets only signed-in Users through (401 otherwise) and puts them on the context as `user`. */
export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: "signed_out" }, 401);
  c.set("user", user);
  await next();
};

/** The raw session token from this request's cookie, if any. */
export function sessionTokenFrom(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE, "host");
}

export function setSessionCookie(c: Context, token: string, expiresAt: Date) {
  setCookie(c, SESSION_COOKIE, token, { ...COOKIE_OPTIONS, expires: expiresAt });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE, COOKIE_OPTIONS);
}
