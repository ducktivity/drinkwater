-- name: UpsertWaterLog :exec
INSERT INTO water_logs (id, user_id, amount_ml, logged_at, is_deleted, server_updated_at)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (id) DO UPDATE SET
    amount_ml = EXCLUDED.amount_ml,
    is_deleted = EXCLUDED.is_deleted,
    logged_at = EXCLUDED.logged_at,
    server_updated_at = EXCLUDED.server_updated_at;

-- name: GetDeltaWaterLogs :many
SELECT id, amount_ml, logged_at, is_deleted, server_updated_at 
FROM water_logs 
WHERE user_id = $1 AND server_updated_at > $2;

-- name: GetAllWaterLogs :many
SELECT id, amount_ml, logged_at, is_deleted, server_updated_at 
FROM water_logs 
WHERE user_id = $1;