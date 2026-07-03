package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"drinkwater-backend/api"
	"drinkwater-backend/auth"
	"drinkwater-backend/database"
	"drinkwater-backend/database/dbgen"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// GetSettings godoc
// @Summary      Get the current user's UI settings
// @Description  Returns the user's saved UI settings document (bottle size, daily goal, schedule, reminder). Responds 404 when the account has no settings yet, so the client keeps its local fallback values.
// @Tags         settings
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  api.UserSettings  "The user's saved settings document"
// @Failure      401  {object}  map[string]string "Missing or invalid token"
// @Failure      404  {object}  map[string]string "No settings saved for this user yet"
// @Failure      500  {object}  map[string]string "Internal server or database error"
// @Router       /v1/settings [get]
func GetSettings(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	userID, ok := auth.UserIDFromContext(ctx)
	if !ok {
		// RequireAuth guarantees a user; guard so a routing mistake fails closed.
		clientError(w, r, http.StatusUnauthorized, "no user in context", `{"error": "Authentication required"}`)
		return
	}

	row, err := dbgen.New(database.DB).GetUserSettings(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// No settings yet: the client keeps its local fallbacks and the row is
			// created lazily on the first save (PutSettings).
			clientError(w, r, http.StatusNotFound, "no settings for user", `{"error": "No settings saved"}`)
			return
		}
		serverError(w, r, fmt.Errorf("get user settings: %w", err), `{"error": "Could not load settings"}`)
		return
	}

	writeJSON(w, http.StatusOK, api.UserSettings{Settings: row.Settings})
}

// PutSettings godoc
// @Summary      Save the current user's UI settings
// @Description  Upserts the user's UI settings document (stored verbatim as JSON). Creates the row on first save.
// @Tags         settings
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        payload body      api.UserSettings  true  "The settings document to save"
// @Success      200     {object}  api.UserSettings  "The saved settings document"
// @Failure      400     {object}  map[string]string "Invalid request body"
// @Failure      401     {object}  map[string]string "Missing or invalid token"
// @Failure      500     {object}  map[string]string "Internal server or database error"
// @Router       /v1/settings [put]
func PutSettings(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	userID, ok := auth.UserIDFromContext(ctx)
	if !ok {
		clientError(w, r, http.StatusUnauthorized, "no user in context", `{"error": "Authentication required"}`)
		return
	}

	var input api.UserSettings
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		clientError(w, r, http.StatusBadRequest, fmt.Sprintf("decode settings payload: %v", err), `{"error": "Invalid JSON payload"}`)
		return
	}
	defer r.Body.Close()

	// The document is opaque, but it must be present and well-formed JSON so we
	// never persist garbage into the jsonb column.
	if len(input.Settings) == 0 || !json.Valid(input.Settings) {
		clientError(w, r, http.StatusBadRequest, "missing or invalid settings document", `{"error": "A valid settings document is required"}`)
		return
	}

	err := dbgen.New(database.DB).UpsertUserSettings(ctx, dbgen.UpsertUserSettingsParams{
		UserID:          userID,
		Settings:        input.Settings,
		ServerUpdatedAt: pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
	})
	if err != nil {
		serverError(w, r, fmt.Errorf("upsert user settings: %w", err), `{"error": "Could not save settings"}`)
		return
	}

	writeJSON(w, http.StatusOK, input)
}
