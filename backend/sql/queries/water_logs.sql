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

-- name: GetWaterLogsInRange :many
-- Returns a user's non-deleted logs whose logged_at falls within the half-open range [from, to). The client passes the start of the selected local day and the start of the following day, so day boundaries honour the client's timezone.
SELECT id, amount_ml, logged_at, is_deleted, server_updated_at
FROM water_logs
WHERE user_id = $1
  AND is_deleted = FALSE
  AND logged_at >= $2
  AND logged_at < $3
ORDER BY logged_at DESC;