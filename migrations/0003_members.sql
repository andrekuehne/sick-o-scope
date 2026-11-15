-- Members: the people whose health is tracked (GLOSSARY.md), whether or not they ever sign in.
-- Archived Members get no new Check-ins but keep their history.

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  colour TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX members_by_family ON members (family_id, sort_order);
