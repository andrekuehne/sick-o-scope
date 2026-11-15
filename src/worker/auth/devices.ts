// Signed-in Devices. A Device is known by the token in its session cookie;
// the database stores only the token's hash. Every query on `devices` lives here.

import { hashToken, newToken } from "./tokens.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

/** A Device stays signed in for a year after it was last used. */
export const DEVICE_SIGN_IN_LIFETIME_MS = 365 * DAY_MS;

/** Renewing costs a write, so a Device's expiry and `last_seen_at` move at most once a day. */
const RENEW_AFTER_MS = DAY_MS;

/** A Device about to be signed in: its id, and the session token that goes into its cookie only. */
export type NewDevice = { deviceId: string; token: string; tokenHash: string; expiresAt: Date };

export async function prepareNewDevice(now: Date): Promise<NewDevice> {
  const token = newToken();
  return {
    deviceId: crypto.randomUUID(),
    token,
    tokenHash: await hashToken(token),
    expiresAt: new Date(now.getTime() + DEVICE_SIGN_IN_LIFETIME_MS),
  };
}

/**
 * Inserts the new Device for the User that `userIdSql` selects, so the Device can be
 * created inside another statement's transaction (see redeemSignInLink).
 * `userIdSql` is a `SELECT user_id … ` with its own parameters, appended after the Device's.
 */
export function insertDeviceForSelectedUser(
  db: D1Database,
  device: NewDevice,
  label: string,
  now: Date,
  userIdSql: string,
  ...userIdParams: unknown[]
): D1PreparedStatement {
  const at = now.toISOString();
  return db
    .prepare(
      `INSERT INTO devices (id, user_id, session_token_hash, label, created_at, last_seen_at, expires_at)
       SELECT ?, user_id, ?, ?, ?, ?, ? FROM (${userIdSql})
       RETURNING user_id`,
    )
    .bind(device.deviceId, device.tokenHash, label, at, at, device.expiresAt.toISOString(), ...userIdParams);
}

export type SignedInDevice = {
  deviceId: string;
  userId: string;
  /** Set when this request renewed the Device's year, so its cookie must be renewed too. */
  renewedUntil: Date | null;
};

/**
 * The Device and User behind a session token, or null when the token is unknown,
 * signed out or expired. Renews the Device's year when it was last renewed a day ago or more.
 */
export async function signedInDevice(db: D1Database, token: string, now: Date): Promise<SignedInDevice | null> {
  const row = await db
    .prepare("SELECT id, user_id, last_seen_at, expires_at FROM devices WHERE session_token_hash = ?")
    .bind(await hashToken(token))
    .first<{ id: string; user_id: string; last_seen_at: string; expires_at: string }>();
  if (!row || new Date(row.expires_at) <= now) return null;

  if (now.getTime() - new Date(row.last_seen_at).getTime() < RENEW_AFTER_MS) {
    return { deviceId: row.id, userId: row.user_id, renewedUntil: null };
  }
  const renewedUntil = new Date(now.getTime() + DEVICE_SIGN_IN_LIFETIME_MS);
  await db
    .prepare("UPDATE devices SET last_seen_at = ?, expires_at = ? WHERE id = ?")
    .bind(now.toISOString(), renewedUntil.toISOString(), row.id)
    .run();
  return { deviceId: row.id, userId: row.user_id, renewedUntil };
}

/** Signs out the Device behind a session token, if any. */
export async function signOutDevice(db: D1Database, token: string): Promise<void> {
  await db.prepare("DELETE FROM devices WHERE session_token_hash = ?").bind(await hashToken(token)).run();
}
