// Package auth gates Drinkwater's protected routes. The central identity service (id.ducktvt.com) is the sole token issuer; Drinkwater only VERIFIES the EdDSA tokens it mints, via the shared platform-go/authverify module fetching the issuer's public keys (JWKS).
//
// This package is a thin adapter exposing auth.RequireAuth / auth.UserIDFromContext to the rest of the backend; the source of truth for a token is the issuer's remote public key.
package auth

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/httplog/v2"
	"github.com/google/uuid"

	"github.com/ducktivity/platform-go/authtoken"
	"github.com/ducktivity/platform-go/authverify"
)

// verifier validates incoming tokens against the identity service's JWKS. It is set once at startup by Init; RequireAuth panics if used before Init, which a misordered startup would surface immediately.
var verifier *authverify.Verifier

// Init wires the token verifier. Call once at startup with the identity service's JWKS URL (e.g. https://id.ducktvt.com/.well-known/jwks.json) and its issuer string. It performs the initial key fetch, so a misconfigured issuer fails fast.
func Init(ctx context.Context, jwksURL, issuer string) error {
	v, err := authverify.New(ctx, jwksURL, issuer)
	if err != nil {
		return err
	}
	verifier = v
	return nil
}

// RequireAuth rejects requests without a valid bearer token (401) and otherwise injects the caller's principal for downstream handlers. It also stamps the authenticated user id onto the request-summary log line.
func RequireAuth(next http.Handler) http.Handler {
	return verifier.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if uid, ok := authverify.UserIDFromContext(r.Context()); ok {
			httplog.LogEntrySetFields(r.Context(), map[string]interface{}{"user_id": uid.String()})
		}
		next.ServeHTTP(w, r)
	}))
}

// UserIDFromContext returns the authenticated user's UUID. The bool is false when called outside an authenticated request.
func UserIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	return authverify.UserIDFromContext(ctx)
}

// PrincipalFromContext returns the full authenticated principal (user id, email, suite-wide entitlement) for handlers that need more than the user id.
func PrincipalFromContext(ctx context.Context) (authverify.Principal, bool) {
	return authverify.PrincipalFromContext(ctx)
}

// EntitlementFromContext returns the suite-wide entitlement carried in the token. This is how Drinkwater learns paid access without ever calling Stripe or the identity service: one payment flips one entitlement, and every app reads it here.
func EntitlementFromContext(ctx context.Context) (authtoken.Entitlement, bool) {
	p, ok := authverify.PrincipalFromContext(ctx)
	return p.Entitlement, ok
}

// RequirePro gates a route behind the suite-wide paid plan. Drinkwater has no paid features today, so nothing uses it yet — it is the seam for the "one payment unlocks all apps" model: wrap any future premium route with this and it is unlocked by the same entitlement that unlocks every other app in the suite.
func RequirePro(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ent, ok := EntitlementFromContext(r.Context())
		if !ok || !ent.IsPro(time.Now().Unix()) {
			httplog.LogEntrySetFields(r.Context(), map[string]interface{}{"error": "pro required", "client_error": true})
			http.Error(w, `{"error":"This feature requires Ducktivity Pro"}`, http.StatusPaymentRequired)
			return
		}
		next.ServeHTTP(w, r)
	})
}
