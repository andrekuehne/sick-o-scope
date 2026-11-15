-- Severity now runs from 0 (Fast gesund: almost well, a leftover Symptom) to 5.
-- SQLite can't change a CHECK constraint in place, so check_ins is rebuilt and every row
-- copied over, together with check_in_symptoms, which refers to it. Nothing is lost:
-- the new tables are filled before the old ones are dropped, all in one transaction.

PRAGMA defer_foreign_keys = true;

CREATE TABLE check_ins_new (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  -- A local calendar date, YYYY-MM-DD, not a timestamp.
  date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  status TEXT NOT NULL CHECK (status IN ('healthy', 'sick')),
  -- Healthy has no Severity; Sick always has a whole number from 0 to 5. (The typeof check
  -- also rules out NULL: for NULL the BETWEEN alone is NULL, not false, and SQLite accepts it.)
  severity INTEGER CHECK (
    (status = 'healthy' AND severity IS NULL)
    OR (status = 'sick' AND typeof(severity) = 'integer' AND severity BETWEEN 0 AND 5)
  ),
  note TEXT CHECK (note IS NULL OR length(note) <= 500),
  -- Who saved it last; kept as NULL if that User is removed later.
  updated_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (member_id, date)
);

INSERT INTO check_ins_new (id, family_id, member_id, date, status, severity, note, updated_by, created_at, updated_at)
SELECT id, family_id, member_id, date, status, severity, note, updated_by, created_at, updated_at FROM check_ins;

CREATE TABLE check_in_symptoms_new (
  check_in_id TEXT NOT NULL REFERENCES check_ins_new (id) ON DELETE CASCADE,
  symptom_key TEXT NOT NULL,
  PRIMARY KEY (check_in_id, symptom_key)
);

INSERT INTO check_in_symptoms_new (check_in_id, symptom_key) SELECT check_in_id, symptom_key FROM check_in_symptoms;

-- The old Symptoms first, so dropping the old Check-ins has nothing left to cascade to.
DROP TABLE check_in_symptoms;
DROP TABLE check_ins;

-- Renaming also points check_in_symptoms_new's reference at the renamed table.
ALTER TABLE check_ins_new RENAME TO check_ins;
ALTER TABLE check_in_symptoms_new RENAME TO check_in_symptoms;

CREATE INDEX check_ins_by_family_date ON check_ins (family_id, date);
