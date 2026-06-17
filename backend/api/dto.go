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
	IsDeleted bool      `json:"is_deleted" validate:"required"`
}

// SyncResponse represents the JSON payload sent back to the client.
type SyncResponse struct {
	Changes    []WaterLog `json:"changes" validate:"required"`
	ServerTime time.Time  `json:"server_time" validate:"required"`
}

// LogsResponse represents the JSON payload returned when fetching the logs for a
// specific day. It carries only the non-deleted entries that fall within the
// requested range, most recent first.
type LogsResponse struct {
	Logs []WaterLog `json:"logs" validate:"required"`
}

// AuthRequestInput is the body of POST /auth/request: the email a login code
// should be sent to. An unknown email transparently creates the account.
type AuthRequestInput struct {
	Email string `json:"email" validate:"required"`
}

// AuthVerifyInput is the body of POST /auth/verify: the email plus the 6-digit
// code the user received, exchanged for a session token.
type AuthVerifyInput struct {
	Email string `json:"email" validate:"required"`
	Code  string `json:"code" validate:"required"`
}

// User is the public representation of an account returned to the client.
type User struct {
	ID    uuid.UUID `json:"id" validate:"required"`
	Email string    `json:"email" validate:"required"`
}

// AuthResponse is returned on successful verification: the session JWT the client
// stores and sends as a bearer token, plus the authenticated user.
type AuthResponse struct {
	Token string `json:"token" validate:"required"`
	User  User   `json:"user" validate:"required"`
}

// MessageResponse is a generic single-message body (e.g. the deliberately vague
// acknowledgement returned by POST /auth/request).
type MessageResponse struct {
	Message string `json:"message" validate:"required"`
}
