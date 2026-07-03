package handlers

import (
	"net/http"

	"drinkwater-backend/api"
	"drinkwater-backend/auth"
)

// GetMe godoc
// @Summary      Get the current user
// @Description  Returns the account for the supplied bearer token, read straight from the verified token claims. Used by clients to validate a stored token on startup.
// @Tags         auth
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  api.User          "The authenticated user"
// @Failure      401  {object}  map[string]string "Missing or invalid token"
// @Router       /v1/auth/me [get]
//
// Login itself (requesting and verifying a code) lives in the central identity service, not here: Drinkwater only verifies the token the identity service issued. GetMe therefore needs no database read — the user id and email travel in the token.
func GetMe(w http.ResponseWriter, r *http.Request) {
	p, ok := auth.PrincipalFromContext(r.Context())
	if !ok {
		// RequireAuth guarantees this; guard anyway so a routing mistake fails closed.
		clientError(w, r, http.StatusUnauthorized, "no principal in context", `{"error": "Authentication required"}`)
		return
	}
	writeJSON(w, http.StatusOK, api.User{ID: p.UserID, Email: p.Email})
}
