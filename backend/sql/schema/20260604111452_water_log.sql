-- +goose Up
CREATE TABLE water_logs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    amount_ml INT NOT NULL,
    logged_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    server_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_water_logs_server_sync ON water_logs (user_id, server_updated_at);

-- +goose Down
DROP TABLE water_logs;