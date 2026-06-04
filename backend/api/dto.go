package api

import (
	"time"

	"github.com/google/uuid"
)

// WaterLog represents the exact JSON payload sent by the SolidJS client.
type WaterLog struct {
	ID        uuid.UUID `json:"id" validate:"required"`
	AmountMl  int32     `json:"amount_ml" validate:"required"`
	LoggedAt  time.Time `json:"logged_at" validate:"required"`
	IsDeleted bool      `json:"is_deleted"`
}

// SyncResponse represents the JSON payload sent back to the client.
type SyncResponse struct {
	Changes    []WaterLog `json:"changes"`
	ServerTime time.Time  `json:"server_time"`
}
