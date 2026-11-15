// A Family's Users. Their Devices live in auth/devices.ts.

import type { FamilyUsers } from "../../shared/users.ts";
import { devicesOfFamily, signOutDevicesOfUserWithoutFamily } from "../auth/devices.ts";

/**
 * Removes a User from the Family, in one transaction: they leave it, their Devices are
 * signed out and their unused Sign-in links stop working. The User's name stays, so their
 * Check-ins still say who saved them. The last User is kept, so the Family isn't left with nobody.
 */
export async function removeUser(
  db: D1Database,
  familyId: string,
  userId: string,
): Promise<"removed" | "not_found" | "last_user"> {
  const [left] = await db.batch([
    db
      .prepare(
        `DELETE FROM family_users
         WHERE family_id = ? AND user_id = ? AND (SELECT COUNT(*) FROM family_users WHERE family_id = ?) > 1
         RETURNING user_id`,
      )
      .bind(familyId, userId, familyId),
    signOutDevicesOfUserWithoutFamily(db, userId),
    db
      .prepare(
        `DELETE FROM sign_in_links WHERE family_id = ? AND for_user_id = ? AND used_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM family_users WHERE family_id = ? AND user_id = ?)`,
      )
      .bind(familyId, userId, familyId, userId),
  ]);
  if ((left?.results.length ?? 0) > 0) return "removed";
  const inFamily = await db
    .prepare("SELECT 1 FROM family_users WHERE family_id = ? AND user_id = ?")
    .bind(familyId, userId)
    .first();
  return inFamily ? "last_user" : "not_found";
}

/**
 * The Family's Users in the order they joined, each with their signed-in Devices, as seen
 * from one Device: which User is "me", and which Device is this one.
 */
export async function familyUsersWithDevices(
  db: D1Database,
  familyId: string,
  viewer: { userId: string; deviceId: string },
  now = new Date(),
): Promise<FamilyUsers> {
  const [{ results: users }, devices] = await Promise.all([
    db
      .prepare(
        `SELECT u.id, u.display_name AS name FROM users u
         JOIN family_users fu ON fu.user_id = u.id
         WHERE fu.family_id = ?
         ORDER BY fu.created_at, u.display_name`,
      )
      .bind(familyId)
      .all<{ id: string; name: string }>(),
    devicesOfFamily(db, familyId, now),
  ]);
  return {
    users: users.map((user) => ({
      ...user,
      isMe: user.id === viewer.userId,
      devices: devices
        .filter((d) => d.userId === user.id)
        .map(({ id, label, lastSeenAt }) => ({ id, label, lastSeenAt, isThisDevice: id === viewer.deviceId })),
    })),
  };
}
