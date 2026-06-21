-- name: GetUserSettings :one
SELECT settings, server_updated_at FROM user_settings WHERE user_id = $1;

-- name: UpsertUserSettings :exec
INSERT INTO user_settings (user_id, settings, server_updated_at)
VALUES ($1, $2, $3)
ON CONFLICT (user_id) DO UPDATE SET
    settings          = EXCLUDED.settings,
    server_updated_at = EXCLUDED.server_updated_at;
