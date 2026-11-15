import type { SignInLinkRequest } from "../../shared/users.ts";
import { insertDeviceForSelectedUser, prepareNewDevice } from "./devices.ts";
import { hashToken, newToken } from "./tokens.ts";

/** A Sign-in link works once, within a day of being created. */
export const SIGN_IN_LINK_LIFETIME_MS = 24 * 60 * 60 * 1000;

/**
 * Creates a Sign-in link. Returns the raw token, which exists only here: the database
 * keeps its hash. Returns null for an existing User who isn't in that Family.
 * `createdBy` is the User who made it in the app; the setup command leaves it out.
 */
export async function createSignInLink(
  db: D1Database,
  { familyId, createdBy = null, ...forWhom }: { familyId: string; createdBy?: string | null } & SignInLinkRequest,
  now = new Date(),
): Promise<{ token: string; expiresAt: Date } | null> {
  const token = newToken();
  const expiresAt = new Date(now.getTime() + SIGN_IN_LINK_LIFETIME_MS);
  // Who it signs in (an existing User of the Family, or a new User) goes after these.
  const linkValues = [crypto.randomUUID(), await hashToken(token), createdBy, now.toISOString(), expiresAt.toISOString()];
  // RETURNING rather than meta.changes: the setup command's database (scripts/wrangler-d1.ts)
  // doesn't report changes when run locally.
  const inserted = await ("forUserId" in forWhom
    ? db
        .prepare(
          `INSERT INTO sign_in_links (id, token_hash, created_by, created_at, expires_at, family_id, for_user_id)
           SELECT ?, ?, ?, ?, ?, family_id, user_id FROM family_users WHERE family_id = ? AND user_id = ?
           RETURNING id`,
        )
        .bind(...linkValues, familyId, forWhom.forUserId)
    : db
        .prepare(
          `INSERT INTO sign_in_links (id, token_hash, created_by, created_at, expires_at, family_id, new_user_name)
           SELECT ?, ?, ?, ?, ?, id, ? FROM families WHERE id = ?
           RETURNING id`,
        )
        .bind(...linkValues, forWhom.newUserName, familyId)
  ).first<{ id: string }>();
  return inserted ? { token, expiresAt } : null;
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
 * Redeems a Sign-in link: claims it, creates the new User if the link is for one, and signs
 * in a new Device, all in one transaction. So a link can never sign in two Devices (or create
 * two Users), even when redeemed twice at the same moment.
 */
export async function redeemSignInLink(
  db: D1Database,
  token: string,
  { deviceLabel }: { deviceLabel: string },
  now = new Date(),
): Promise<Redemption> {
  const tokenHash = await hashToken(token);
  const device = await prepareNewDevice(now);
  const newUserId = crypto.randomUUID();
  const at = now.toISOString();
  // The link this redemption just claimed, if it did; every later statement depends on it.
  const fromClaimedLink = "FROM sign_in_links WHERE token_hash = ? AND used_by_device_id = ?";

  const [claim, , , inserted] = await db.batch<{ user_id: string }>([
    // Claims the link, marking it with the new Device's id, only if it is still usable.
    db
      .prepare(
        `UPDATE sign_in_links SET used_at = ?, used_by_device_id = ?
         WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`,
      )
      .bind(at, device.deviceId, tokenHash, at),
    // A link for a new User creates that User in the link's Family.
    db
      .prepare(`INSERT INTO users (id, display_name, created_at) SELECT ?, new_user_name, ? ${fromClaimedLink} AND new_user_name IS NOT NULL`)
      .bind(newUserId, at, tokenHash, device.deviceId),
    db
      .prepare(`INSERT INTO family_users (family_id, user_id, created_at) SELECT family_id, ?, ? ${fromClaimedLink} AND new_user_name IS NOT NULL`)
      .bind(newUserId, at, tokenHash, device.deviceId),
    // Signs in the Device only if the claim above succeeded.
    insertDeviceForSelectedUser(
      db,
      device,
      deviceLabel,
      now,
      `SELECT COALESCE(for_user_id, ?) AS user_id ${fromClaimedLink}`,
      newUserId,
      tokenHash,
      device.deviceId,
    ),
  ]);

  const userId = inserted?.results[0]?.user_id;
  if (claim?.meta.changes === 1 && userId) {
    return { ok: true, userId, deviceToken: device.token, deviceExpiresAt: device.expiresAt };
  }

  const link = await db
    .prepare("SELECT used_at, expires_at FROM sign_in_links WHERE token_hash = ?")
    .bind(tokenHash)
    .first<{ used_at: string | null; expires_at: string }>();
  if (link?.used_at) return { ok: false, reason: "used" };
  if (link && new Date(link.expires_at) <= now) return { ok: false, reason: "expired" };
  return { ok: false, reason: "unknown" };
}
