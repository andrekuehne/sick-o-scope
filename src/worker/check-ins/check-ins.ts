// Check-ins of a Family. Every query is scoped by family_id; callers check that a Member
// belongs to the Family before writing (see routes.ts).

import type { CheckIn, CheckInState, FillGapsResult, Severity } from "../../shared/check-ins.ts";
import type { SymptomKey } from "../../shared/symptoms.ts";

type CheckInRow = {
  member_id: string;
  date: string;
  status: "healthy" | "sick";
  severity: number | null;
  new_bug: 0 | 1;
  note: string | null;
  updated_by_name: string | null;
  updated_at: string;
  symptoms: string;
};

const SELECT_CHECK_INS = `
  SELECT c.member_id, c.date, c.status, c.severity, c.new_bug, c.note, c.updated_at, u.display_name AS updated_by_name,
         (SELECT json_group_array(symptom_key)
            FROM (SELECT symptom_key FROM check_in_symptoms WHERE check_in_id = c.id ORDER BY symptom_key)) AS symptoms
  FROM check_ins c LEFT JOIN users u ON u.id = c.updated_by`;

function toCheckIn(row: CheckInRow): CheckIn {
  const saved = { memberId: row.member_id, date: row.date, note: row.note, updatedBy: row.updated_by_name, updatedAt: row.updated_at };
  if (row.status === "healthy") return { ...saved, status: "healthy" };
  return {
    ...saved,
    status: "sick",
    severity: row.severity as Severity,
    symptoms: JSON.parse(row.symptoms) as SymptomKey[],
    newBug: row.new_bug === 1,
  };
}

/** The Family's Check-ins from `from` to `to` (both included), by date. */
export async function checkInsBetween(db: D1Database, familyId: string, from: string, to: string): Promise<CheckIn[]> {
  const { results } = await db
    .prepare(`${SELECT_CHECK_INS} WHERE c.family_id = ? AND c.date BETWEEN ? AND ? ORDER BY c.date, c.member_id`)
    .bind(familyId, from, to)
    .all<CheckInRow>();
  return results.map(toCheckIn);
}

/**
 * Every Check-in of the Family, by date: what records and earlier Seasons are worked out from.
 * A Family's data stays small (around a thousand Check-ins a year), so it comes in one go.
 */
export async function allCheckIns(db: D1Database, familyId: string): Promise<CheckIn[]> {
  const { results } = await db
    .prepare(`${SELECT_CHECK_INS} WHERE c.family_id = ? ORDER BY c.date, c.member_id`)
    .bind(familyId)
    .all<CheckInRow>();
  return results.map(toCheckIn);
}

/** A Check-in together with its Member's name, as the CSV export lists it. */
export type CheckInWithMemberName = CheckIn & { memberName: string };

/** Every Check-in of the Family, by date and then in the Members' order, with the Member's name. */
export async function allCheckInsWithMemberNames(db: D1Database, familyId: string): Promise<CheckInWithMemberName[]> {
  const { results } = await db
    .prepare(
      `SELECT checked.*, m.name AS member_name FROM (${SELECT_CHECK_INS} WHERE c.family_id = ?) checked
       JOIN members m ON m.id = checked.member_id
       ORDER BY checked.date, m.sort_order, m.created_at`,
    )
    .bind(familyId)
    .all<CheckInRow & { member_name: string }>();
  return results.map((row) => ({ ...toCheckIn(row), memberName: row.member_name }));
}

async function checkInOn(db: D1Database, familyId: string, memberId: string, date: string): Promise<CheckIn | null> {
  const row = await db
    .prepare(`${SELECT_CHECK_INS} WHERE c.family_id = ? AND c.member_id = ? AND c.date = ?`)
    .bind(familyId, memberId, date)
    .first<CheckInRow>();
  return row ? toCheckIn(row) : null;
}

/** Of these Member ids, the ones that belong to the Family. */
export async function membersOfFamily(db: D1Database, familyId: string, memberIds: string[]): Promise<Set<string>> {
  // All of the Family's Member ids (a handful), rather than one bound parameter per asked-for id:
  // D1 allows at most 100 parameters per query.
  const { results } = await db.prepare("SELECT id FROM members WHERE family_id = ?").bind(familyId).all<{ id: string }>();
  const family = new Set(results.map((r) => r.id));
  return new Set(memberIds.filter((id) => family.has(id)));
}

type DayWrite = { memberId: string; date: string; state: CheckInState };
type Context = { familyId: string; userId: string; now: Date };

/** One Check-in row (plus its Symptoms) as JSON, for inserting many rows with a single bound parameter. */
function rowsAsJson(writes: (DayWrite & { id: string })[], { familyId, userId, now }: Context) {
  const at = now.toISOString();
  return {
    checkIns: JSON.stringify(
      writes.map(({ id, memberId, date, state }) => ({
        id,
        familyId,
        memberId,
        date,
        status: state.status,
        severity: state.status === "sick" ? state.severity : null,
        newBug: state.status === "sick" && state.newBug ? 1 : 0,
        note: state.note,
        updatedBy: userId,
        at,
      })),
    ),
    symptoms: JSON.stringify(
      writes.flatMap(({ id, state }) => (state.status === "sick" ? state.symptoms : []).map((key) => ({ id, key }))),
    ),
  };
}

// D1 limits both the parameters per query (100) and the queries per request (50 on the free plan),
// so rows travel as one JSON parameter and are unpacked with json_each: a fixed handful of
// statements however many days and Symptoms. (WHERE true lets SQLite parse the ON CONFLICT.)
const INSERT_CHECK_INS_FROM_JSON = `INSERT INTO check_ins
  (id, family_id, member_id, date, status, severity, new_bug, note, updated_by, created_at, updated_at)
  SELECT j.value ->> 'id', j.value ->> 'familyId', j.value ->> 'memberId', j.value ->> 'date',
         j.value ->> 'status', j.value ->> 'severity', j.value ->> 'newBug', j.value ->> 'note', j.value ->> 'updatedBy',
         j.value ->> 'at', j.value ->> 'at'
  FROM json_each(?) j WHERE true`;

/** Symptoms for Check-ins that exist: one just written, or the day just saved. */
const INSERT_SYMPTOMS_FROM_JSON = `INSERT INTO check_in_symptoms (check_in_id, symptom_key)
  SELECT j.value ->> 'id', j.value ->> 'key' FROM json_each(?) j
  WHERE EXISTS (SELECT 1 FROM check_ins WHERE id = j.value ->> 'id')`;

/**
 * Saves a Member's day as a complete state: it replaces whatever was there, Symptoms
 * included, in one transaction. Saving the same state twice changes nothing.
 */
export async function saveCheckIn(db: D1Database, write: DayWrite & Context): Promise<CheckIn> {
  const { familyId, memberId, date } = write;
  // A day that already exists keeps its row and id (ON CONFLICT … DO UPDATE); the new id is then unused.
  const rows = rowsAsJson([{ ...write, id: crypto.randomUUID() }], write);

  await db.batch([
    db
      .prepare(
        `${INSERT_CHECK_INS_FROM_JSON} ON CONFLICT (member_id, date) DO UPDATE SET
           status = excluded.status, severity = excluded.severity, new_bug = excluded.new_bug, note = excluded.note,
           updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      )
      .bind(rows.checkIns),
    db
      .prepare("DELETE FROM check_in_symptoms WHERE check_in_id = (SELECT id FROM check_ins WHERE member_id = ? AND date = ?)")
      .bind(memberId, date),
    // Symptoms attach to the day's row, whichever id it has.
    db
      .prepare(
        `INSERT INTO check_in_symptoms (check_in_id, symptom_key)
         SELECT (SELECT id FROM check_ins WHERE member_id = ? AND date = ?), j.value ->> 'key' FROM json_each(?) j`,
      )
      .bind(memberId, date, rows.symptoms),
  ]);
  const saved = await checkInOn(db, familyId, memberId, date);
  if (!saved) throw new Error("A saved Check-in can't be read back");
  return saved;
}

/** Turns a Member's day back into a Gap. */
export async function deleteCheckIn(db: D1Database, familyId: string, memberId: string, date: string): Promise<void> {
  await db
    .prepare("DELETE FROM check_ins WHERE family_id = ? AND member_id = ? AND date = ?")
    .bind(familyId, memberId, date)
    .run();
}

/**
 * Writes Check-ins only where a Member has none for that date, never over an existing one,
 * all in one transaction. Reports which days were written and which were skipped.
 */
export async function fillGaps(db: D1Database, writes: DayWrite[], context: Context): Promise<FillGapsResult> {
  const planned = writes.map((w) => ({ ...w, id: crypto.randomUUID() }));
  const rows = rowsAsJson(planned, context);
  const [inserted] = await db.batch<{ id: string }>([
    db.prepare(`${INSERT_CHECK_INS_FROM_JSON} ON CONFLICT (member_id, date) DO NOTHING RETURNING id`).bind(rows.checkIns),
    // Only rows written just now exist under their new ids, so skipped days get no Symptoms.
    db.prepare(INSERT_SYMPTOMS_FROM_JSON).bind(rows.symptoms),
  ]);
  const writtenIds = new Set(inserted?.results.map((row) => row.id));

  const result: FillGapsResult = { written: [], skipped: [] };
  for (const w of planned) {
    (writtenIds.has(w.id) ? result.written : result.skipped).push({ memberId: w.memberId, date: w.date });
  }
  return result;
}
