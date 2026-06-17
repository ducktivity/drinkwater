// Package auth implements the backend half of Drinkwater's passwordless,
// email-OTP authentication: issuing/verifying short-lived login codes, minting
// and validating session JWTs, and the Chi middleware that gates protected
// routes. The single server secret (AUTH_JWT_SECRET) both signs JWTs and peppers
// the code hashes, so it must be configured once at startup via SetSecret.
package auth

import "errors"

// secret signs session JWTs and peppers one-time code hashes. It is set once at
// startup from AUTH_JWT_SECRET; an empty secret means auth was never configured.
var secret []byte

// ErrNotConfigured is returned by signing/verification helpers when SetSecret was
// never called with a non-empty value (a misconfigured deployment).
var ErrNotConfigured = errors.New("auth: server secret not configured")

// SetSecret wires the server secret used for JWT signing and code hashing. Call
// it once during startup, after environment variables are loaded.
func SetSecret(s string) {
	secret = []byte(s)
}

// configured reports whether a non-empty secret has been set.
func configured() bool {
	return len(secret) > 0
}
