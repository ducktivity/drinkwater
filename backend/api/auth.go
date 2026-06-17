package api

import (
	"github.com/google/uuid"
)

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
