-- API keys for paid-tier programmatic access.
-- Keys are stored as SHA-256 hashes; only the prefix is kept for display.
CREATE TABLE api_keys (
  id           TEXT    PRIMARY KEY,           -- UUID
  user_id      TEXT    NOT NULL,              -- FK → users.id
  name         TEXT    NOT NULL,              -- user-provided label
  key_prefix   TEXT    NOT NULL,              -- first 12 chars of plaintext key (display only)
  key_hash     TEXT    NOT NULL UNIQUE,       -- SHA-256 of full plaintext key
  created_at   INTEGER NOT NULL,              -- epoch ms
  last_used_at INTEGER,                       -- nullable; updated on each API call
  revoked_at   INTEGER                        -- nullable soft-delete
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id, created_at DESC);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
