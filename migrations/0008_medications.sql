-- Medications (GLOSSARY.md): what a Member took on a Sick day, from a fixed catalog, yes or no.
-- Stored like Symptoms: only the key. Every existing day reads as "none taken".

CREATE TABLE check_in_medications (
  check_in_id TEXT NOT NULL REFERENCES check_ins (id) ON DELETE CASCADE,
  medication_key TEXT NOT NULL,
  PRIMARY KEY (check_in_id, medication_key)
);
