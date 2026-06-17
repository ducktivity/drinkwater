package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/google/uuid"
)

// tokenTTL is how long a session JWT stays valid. Thirty days suits a low-risk,
// local-first hydration app: there is no refresh token, so the user simply
// requests a fresh login code when it expires.
const tokenTTL = 30 * 24 * time.Hour

// IssueToken mints a signed HS256 session token whose subject is the user's UUID.
func IssueToken(userID uuid.UUID) (string, error) {
	if !configured() {
		return "", ErrNotConfigured
	}
	now := time.Now()
	claims := jwt.RegisteredClaims{
		Subject:   userID.String(),
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(tokenTTL)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

// ParseToken validates a session token's signature and expiry and returns the
// user UUID carried in its subject claim.
func ParseToken(tokenString string) (uuid.UUID, error) {
	if !configured() {
		return uuid.Nil, ErrNotConfigured
	}

	var claims jwt.RegisteredClaims
	_, err := jwt.ParseWithClaims(tokenString, &claims, func(t *jwt.Token) (interface{}, error) {
		// Pin the algorithm to HMAC so a token can't smuggle in "alg: none" or a
		// public-key method and bypass verification.
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return secret, nil
	})
	if err != nil {
		return uuid.Nil, err
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid subject claim: %w", err)
	}
	return userID, nil
}
