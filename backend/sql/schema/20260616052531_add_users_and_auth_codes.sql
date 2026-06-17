-- +goose Up

-- Accounts. Email is the sole identifier (passwordless, email-OTP auth); it is
-- stored already-lowercased by the handler so the UNIQUE constraint is truly
-- case-insensitive without needing the citext extension.
CREATE TABLE users (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email      TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Short-lived one-time login codes. We never store the raw 6-digit code, only a
-- SHA-256 hash (peppered with the server secret) so a database leak does not
-- reveal in-flight codes. attempts caps brute-force guessing; consumed_at marks
-- a code as spent so it cannot be replayed.
CREATE TABLE auth_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash   TEXT NOT NULL,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed_at TIMESTAMP WITH TIME ZONE,
    attempts    INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- The verify path fetches the newest still-valid code for a user; this index
-- serves that lookup (and the per-user rate-limit check on request).
CREATE INDEX idx_auth_codes_user ON auth_codes (user_id, created_at DESC);

-- Now that a real users table exists, enforce the previously-implicit link from
-- every water log to its owner. The DELETE clears the pre-auth dummy-user rows
-- (the hardcoded 00000000-... user that has no accounts row); on a fresh prod
-- database this is a no-op.
DELETE FROM water_logs WHERE user_id NOT IN (SELECT id FROM users);
ALTER TABLE water_logs
    ADD CONSTRAINT fk_water_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- +goose Down
ALTER TABLE water_logs DROP CONSTRAINT IF EXISTS fk_water_logs_user;
DROP TABLE IF EXISTS auth_codes;
DROP TABLE IF EXISTS users;
