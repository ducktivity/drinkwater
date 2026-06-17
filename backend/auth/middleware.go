package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/go-chi/httplog/v2"
	"github.com/google/uuid"
)

// contextKey is unexported so only this package can set the user on a context,
// preventing collisions with other packages' context values.
type contextKey struct{}

var userIDKey = contextKey{}

// RequireAuth is Chi middleware that rejects any request lacking a valid
// "Authorization: Bearer <jwt>" header with a 401, and otherwise stores the
// authenticated user's UUID on the request context for downstream handlers.
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		const prefix = "Bearer "
		if !strings.HasPrefix(header, prefix) {
			unauthorized(w, r, "missing bearer token")
			return
		}

		token := strings.TrimSpace(strings.TrimPrefix(header, prefix))
		userID, err := ParseToken(token)
		if err != nil {
			unauthorized(w, r, "invalid token")
			return
		}

		ctx := context.WithValue(r.Context(), userIDKey, userID)
		// Stamp the request-summary line with the acting user so logs can be
		// filtered per account.
		httplog.LogEntrySetFields(ctx, map[string]interface{}{"user_id": userID.String()})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// UserIDFromContext returns the authenticated user's UUID previously stored by
// RequireAuth. The bool is false when called outside an authenticated request.
func UserIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	userID, ok := ctx.Value(userIDKey).(uuid.UUID)
	return userID, ok
}

// unauthorized records the cause on the request-summary line and returns a JSON
// 401. The cause is a client-side fault, so it is deliberately not sent to Sentry.
func unauthorized(w http.ResponseWriter, r *http.Request, cause string) {
	httplog.LogEntrySetFields(r.Context(), map[string]interface{}{
		"error":        cause,
		"client_error": true,
	})
	http.Error(w, `{"error": "Authentication required"}`, http.StatusUnauthorized)
}
