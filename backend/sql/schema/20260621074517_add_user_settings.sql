-- +goose Up

-- Per-user UI settings (bottle size, daily goal, schedule, reminder). The whole
-- settings document is stored verbatim as a single JSONB blob: the backend never
-- inspects its shape, so the frontend stays the sole owner of the settings schema
-- and new settings fields need no migration here. One row per user (PK = user_id),
-- created lazily on the first save. server_updated_at carries the server's truth
-- for future delta/sync use, mirroring water_logs.
CREATE TABLE user_settings (
    user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    settings          JSONB NOT NULL,
    server_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- +goose Down
DROP TABLE IF EXISTS user_settings;
