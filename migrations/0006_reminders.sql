-- Reminders: at most one per Device, a daily push notification at a local time of day.
-- A Reminder goes when its Device is signed out (or its User removed): ON DELETE CASCADE.

CREATE TABLE reminders (
  device_id TEXT PRIMARY KEY REFERENCES devices (id) ON DELETE CASCADE,
  family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  -- Local time of day on a quarter hour, "HH:MM".
  time TEXT NOT NULL CHECK (time GLOB '[0-2][0-9]:[0-5][0-9]'),
  -- The Device's IANA timezone, e.g. Europe/Berlin.
  time_zone TEXT NOT NULL,
  -- The browser's push subscription.
  push_endpoint TEXT NOT NULL,
  push_p256dh TEXT NOT NULL,
  push_auth TEXT NOT NULL,
  -- The Device's local date the Reminder last went off on, so it never goes twice that day.
  last_sent_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
