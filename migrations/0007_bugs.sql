-- Bugs (GLOSSARY.md): a Sick day can say it starts a new Bug although the day before was Sick
-- ("Neuer Infekt"). Only that mark is stored; which Bug a day belongs to, and its number, are
-- worked out from the Check-ins. Every existing day reads as "continues", which is what the rule
-- gives them anyway, so no day changes meaning. A Healthy day is never a new Bug.

ALTER TABLE check_ins ADD COLUMN new_bug INTEGER NOT NULL DEFAULT 0
  CHECK (new_bug IN (0, 1) AND (new_bug = 0 OR status = 'sick'));
