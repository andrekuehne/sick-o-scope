import { insertDeviceForSelectedUser, prepareNewDevice } from "./devices.ts";
import { hashToken, newToken } from "./tokens.ts";

/** A Sign-in link works once, within a day of being created. */
export const SIGN_IN_LINK_LIFETIME_MS = 24 * 60 * 60 * 1000;

/**
 * Creates a Sign-in link for an existing User of the Family. Returns the raw token,
 * which exists only here: the database keeps its hash.
 * Refuses a User who isn't in that Family.
 */
export async function createSignInLink(
  db: D1Database,
  { familyId, forUserId }: { familyId: string; forUserId: string },
  now = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(now.getTime() + SIGN_IN_LINK_LIFETIME_MS);
  // RETURNING rather than meta.changes: the setup command's database (scripts/wrangler-d1.ts)
  // doesn't report changes when run locally.
  const inserted = await db
    .prepare(
      `INSERT INTO sign_in_links (id, family_id, token_hash, for_user_id, created_at, expires_at)
       SELECT ?, family_id, ?, user_id, ?, ? FROM family_users WHERE family_id = ? AND user_id = ?
       RETURNING id`,
    )
    .bind(crypto.randomUUID(), await hashToken(token), now.toISOString(), expiresAt.toISOString(), familyId, forUserId)
    .first<{ id: string }>();
  if (!inserted) throw new Error("That User isn't in this Family.");
  return { token, expiresAt };
}

/**
 * The URL to share. The token sits in the fragment, which browsers never send to
 * the server: opening the link (or a chat app previewing it) can't redeem it or log it.
 */
export function signInLinkUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/anmelden#${token}`;
}

export type Redemption =
  | { ok: true; userId: string; deviceToken: string; deviceExpiresAt: Date }
  | { ok: false; reason: "unknown" | "used" | "expired" };

/**
 * Redeems a Sign-in link: claims it and signs in a new Device in one transaction,
 * so a link can never sign in two Devices, even when redeemed twice at the same moment.
 */
export async function redeemSignInLink(
  db: D1Database,
  token: string,
  { deviceLabel }: { deviceLabel: string },
  now = new Date(),
): Promise<Redemption> {
  const tokenHash = await hashToken(token);
  const device = await prepareNewDevice(now);
  const at = now.toISOString();

  const [claim, inserted] = await db.batch<{ user_id: string }>([
    // Claims the link, marking it with the new Device's id, only if it is still usable.
    db
      .prepare(
        `UPDATE sign_in_links SET used_at = ?, used_by_device_id = ?
         WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? AND for_user_id IS NOT NULL`,
      )
      .bind(at, device.deviceId, tokenHash, at),
    // Signs in the Device only if the claim above succeeded.
    insertDeviceForSelectedUser(
      db,
      device,
      deviceLabel,
      now,
      "SELECT for_user_id AS user_id FROM sign_in_links WHERE token_hash = ? AND used_by_device_id = ?",
      tokenHash,
      device.deviceId,
    ),
  ]);

  const userId = inserted?.results[0]?.user_id;
  if (claim?.meta.changes === 1 && userId) {
    return { ok: true, userId, deviceToken: device.token, deviceExpiresAt: device.expiresAt };
  }

  const link = await db
    .prepare("SELECT used_at, expires_at, for_user_id FROM sign_in_links WHERE token_hash = ?")
    .bind(tokenHash)
    .first<{ used_at: string | null; expires_at: string; for_user_id: string | null }>();
  if (link?.used_at) return { ok: false, reason: "used" };
  if (link && new Date(link.expires_at) <= now) return { ok: false, reason: "expired" };
  // Never issued, or a kind of link this version can't redeem yet (one for a new User).
  return { ok: false, reason: "unknown" };
}
