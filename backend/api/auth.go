package api

import (
	"github.com/google/uuid"
)

// User is the public representation of an account returned to the client.
type User struct {
	ID    uuid.UUID `json:"id" validate:"required"`
	Email string    `json:"email" validate:"required"`
}
