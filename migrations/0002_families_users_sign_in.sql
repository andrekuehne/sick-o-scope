-- Families, Users, their Devices, and the Sign-in links that create Devices (ADR 0002).
-- Timestamps are ISO 8601 UTC strings, so they compare correctly as text.

CREATE TABLE families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- A join table, so a User could belong to several Families later; in v1 every User has exactly one.
CREATE TABLE family_users (
  family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (family_id, user_id)
);

CREATE INDEX family_users_by_user ON family_users (user_id);

-- A signed-in phone or browser. Only the hash of its session token is stored.
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX devices_by_user ON devices (user_id);

-- A one-time link that signs in a new Device, either for an existing User
-- or for a new User joining the Family (exactly one of the two is set).
-- Only the hash of its token is stored.
CREATE TABLE sign_in_links (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  for_user_id TEXT REFERENCES users (id) ON DELETE CASCADE,
  new_user_name TEXT,
  -- NULL when created by the setup command.
  created_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  -- The Device this link signed in; it marks the claim inside the redemption transaction.
  used_by_device_id TEXT,
  CHECK ((for_user_id IS NULL) <> (new_user_name IS NULL))
);
