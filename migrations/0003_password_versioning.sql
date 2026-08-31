ALTER TABLE users
  ADD COLUMN password_hash_version INTEGER NOT NULL DEFAULT 1
  CHECK (password_hash_version = 1);

ALTER TABLE users
  ADD COLUMN password_iterations INTEGER NOT NULL DEFAULT 100000
  CHECK (password_iterations BETWEEN 10000 AND 100000);
