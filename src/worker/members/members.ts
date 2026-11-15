// Members of a Family. Every query is scoped by family_id: a Member id alone never
// reaches another Family's data.

import type { Member, MemberInput } from "../../shared/members.ts";

type MemberRow = { id: string; name: string; emoji: string; colour: string; archived_at: string | null };

const COLUMNS = "id, name, emoji, colour, archived_at";

function toMember(row: MemberRow): Member {
  return { id: row.id, name: row.name, emoji: row.emoji, colour: row.colour, archived: row.archived_at !== null };
}

/** The next position at the end of the Family's order. */
const NEXT_SORT_ORDER = "(SELECT COALESCE(MAX(sort_order), -1) + 1 FROM members WHERE family_id = ?)";

/** All Members of the Family: active ones in their order, then archived ones. */
export async function listMembers(db: D1Database, familyId: string): Promise<Member[]> {
  const { results } = await db
    .prepare(`SELECT ${COLUMNS} FROM members WHERE family_id = ? ORDER BY archived_at IS NOT NULL, sort_order`)
    .bind(familyId)
    .all<MemberRow>();
  return results.map(toMember);
}

/** Adds a Member at the end of the Family's order. */
export async function addMember(
  db: D1Database,
  familyId: string,
  input: MemberInput,
  now = new Date(),
): Promise<Member> {
  const row = await db
    .prepare(
      `INSERT INTO members (id, family_id, name, emoji, colour, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ${NEXT_SORT_ORDER}, ?)
       RETURNING ${COLUMNS}`,
    )
    .bind(crypto.randomUUID(), familyId, input.name, input.emoji, input.colour, familyId, now.toISOString())
    .first<MemberRow>();
  if (!row) throw new Error("Adding the Member returned nothing");
  return toMember(row);
}

/** Changes a Member's name, emoji and colour. Null when the Family has no such Member. */
export async function updateMember(
  db: D1Database,
  familyId: string,
  memberId: string,
  input: MemberInput,
): Promise<Member | null> {
  const row = await db
    .prepare(
      `UPDATE members SET name = ?, emoji = ?, colour = ? WHERE id = ? AND family_id = ? RETURNING ${COLUMNS}`,
    )
    .bind(input.name, input.emoji, input.colour, memberId, familyId)
    .first<MemberRow>();
  return row ? toMember(row) : null;
}

/**
 * Archives a Member (they keep their history), or brings them back at the end of the order.
 * Null when the Family has no such Member.
 */
export async function setArchived(
  db: D1Database,
  familyId: string,
  memberId: string,
  archived: boolean,
  now = new Date(),
): Promise<Member | null> {
  const statement = archived
    ? db
        .prepare(
          `UPDATE members SET archived_at = COALESCE(archived_at, ?) WHERE id = ? AND family_id = ? RETURNING ${COLUMNS}`,
        )
        .bind(now.toISOString(), memberId, familyId)
    : db
        .prepare(
          `UPDATE members SET archived_at = NULL,
             sort_order = CASE WHEN archived_at IS NULL THEN sort_order ELSE ${NEXT_SORT_ORDER} END
           WHERE id = ? AND family_id = ? RETURNING ${COLUMNS}`,
        )
        .bind(familyId, memberId, familyId);
  const row = await statement.first<MemberRow>();
  return row ? toMember(row) : null;
}

/**
 * Puts the Family's active Members in the given order. `memberIds` must name every
 * active Member exactly once. Nothing changes otherwise: "not_found" when an id isn't
 * one of this Family's Members, "incomplete" when the list isn't exactly the active ones.
 */
export async function reorderMembers(
  db: D1Database,
  familyId: string,
  memberIds: string[],
): Promise<"reordered" | "not_found" | "incomplete"> {
  const { results } = await db
    .prepare("SELECT id, archived_at FROM members WHERE family_id = ?")
    .bind(familyId)
    .all<{ id: string; archived_at: string | null }>();
  const familyMembers = new Set(results.map((r) => r.id));
  if (!memberIds.every((id) => familyMembers.has(id))) return "not_found";
  const active = new Set(results.filter((r) => r.archived_at === null).map((r) => r.id));
  const sameMembers = new Set(memberIds).size === memberIds.length && memberIds.length === active.size;
  if (!sameMembers || !memberIds.every((id) => active.has(id))) return "incomplete";

  await db.batch(
    memberIds.map((id, index) =>
      db.prepare("UPDATE members SET sort_order = ? WHERE id = ? AND family_id = ?").bind(index, id, familyId),
    ),
  );
  return "reordered";
}
