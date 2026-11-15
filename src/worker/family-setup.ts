/**
 * Creates a Family together with its first User. Used by the setup command
 * (scripts/setup.ts), since v1 has no way to create a Family in the app.
 */
export async function createFamilyWithFirstUser(
  db: D1Database,
  { familyName, userName }: { familyName: string; userName: string },
  now = new Date(),
): Promise<{ familyId: string; userId: string }> {
  const familyId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const at = now.toISOString();
  await db.batch([
    db.prepare("INSERT INTO families (id, name, created_at) VALUES (?, ?, ?)").bind(familyId, familyName, at),
    db.prepare("INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)").bind(userId, userName, at),
    db
      .prepare("INSERT INTO family_users (family_id, user_id, created_at) VALUES (?, ?, ?)")
      .bind(familyId, userId, at),
  ]);
  return { familyId, userId };
}
