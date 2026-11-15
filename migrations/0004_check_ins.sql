-- Check-ins: one Member's record for one calendar date, Healthy or Sick (GLOSSARY.md).
-- A Member and date without a row is a Gap, never Healthy.

CREATE TABLE check_ins (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  -- A local calendar date, YYYY-MM-DD, not a timestamp.
  date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  status TEXT NOT NULL CHECK (status IN ('healthy', 'sick')),
  -- Healthy has no Severity; Sick always has a whole number from 1 to 5. (The typeof check
  -- also rules out NULL: for NULL the BETWEEN alone is NULL, not false, and SQLite accepts it.)
  severity INTEGER CHECK (
    (status = 'healthy' AND severity IS NULL)
    OR (status = 'sick' AND typeof(severity) = 'integer' AND severity BETWEEN 1 AND 5)
  ),
  note TEXT CHECK (note IS NULL OR length(note) <= 500),
  -- Who saved it last; kept as NULL if that User is removed later.
  updated_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (member_id, date)
);

CREATE INDEX check_ins_by_family_date ON check_ins (family_id, date);

CREATE TABLE check_in_symptoms (
  check_in_id TEXT NOT NULL REFERENCES check_ins (id) ON DELETE CASCADE,
  symptom_key TEXT NOT NULL,
  PRIMARY KEY (check_in_id, symptom_key)
);
