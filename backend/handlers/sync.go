package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"drinkwater-backend/api"
	"drinkwater-backend/auth"
	"drinkwater-backend/database"
	"drinkwater-backend/database/dbgen"

	"github.com/jackc/pgx/v5/pgtype"
)

// PostSync godoc
// @Summary      Sync local water logs with the server
// @Description  Pushes local changes (upserts) to the server and pulls remote changes (delta) made on other devices.
// @Tags         sync
// @Accept       json
// @Produce      json
// @Param        since   query     string           false  "ISO-8601 Timestamp of the client's last sync"
// @Param        payload body      []api.WaterLog   true   "Array of local water logs to sync"
// @Success      200     {object}  api.SyncResponse "Successful sync response containing delta changes"
// @Failure      400     {object}  map[string]string "Invalid request body"
// @Failure      500     {object}  map[string]string "Internal server or database error"
// @Router       /v1/sync [post]
func PostSync(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// The acting user comes from the verified bearer token (RequireAuth, which
	// also stamps the request-summary line with this id).
	userID, ok := auth.UserIDFromContext(ctx)
	if !ok {
		// RequireAuth guarantees a user; guard so a routing mistake fails closed.
		clientError(w, r, http.StatusUnauthorized, "no user in context", `{"error": "Authentication required"}`)
		return
	}

	// 1. Decode the standard JSON body directly into our API DTO
	var incomingLogs []api.WaterLog
	if err := json.NewDecoder(r.Body).Decode(&incomingLogs); err != nil {
		clientError(w, r, http.StatusBadRequest, fmt.Sprintf("decode sync payload: %v", err), `{"error": "Invalid JSON payload"}`)
		return
	}
	defer r.Body.Close()

	// Capture the exact server time for this sync event
	serverNow := time.Now().UTC()

	// 2. Begin a Database Transaction
	tx, err := database.DB.Begin(ctx)
	if err != nil {
		serverError(w, r, fmt.Errorf("begin sync transaction: %w", err), `{"error": "Database connection failed"}`)
		return
	}
	defer tx.Rollback(ctx)

	// Attach sqlc to our active transaction
	qtx := dbgen.New(tx)

	// 3. Process Incoming Changes (Type-safe Upsert)
	for _, log := range incomingLogs {
		err := qtx.UpsertWaterLog(ctx, dbgen.UpsertWaterLogParams{
			ID:              log.ID,
			UserID:          userID,
			AmountMl:        log.AmountMl,
			LoggedAt:        pgtype.Timestamptz{Time: log.LoggedAt, Valid: true},
			IsDeleted:       log.IsDeleted,
			ServerUpdatedAt: pgtype.Timestamptz{Time: serverNow, Valid: true}, // Enforce the server's truth
		})

		if err != nil {
			serverError(w, r, fmt.Errorf("upsert water log %s: %w", log.ID, err), `{"error": "Failed to save local changes"}`)
			return
		}
	}

	// 4. Fetch the Delta (What changed on OTHER devices?)
	var dbLogs []dbgen.GetDeltaWaterLogsRow
	sinceStr := r.URL.Query().Get("since")

	if sinceStr != "" {
		// Client provided a sync token, parse it and fetch only new records
		sinceTime, err := time.Parse(time.RFC3339, sinceStr)
		if err != nil {
			clientError(w, r, http.StatusBadRequest, fmt.Sprintf("invalid since timestamp %q", sinceStr), `{"error": "Invalid since timestamp format"}`)
			return
		}

		dbLogs, err = qtx.GetDeltaWaterLogs(ctx, dbgen.GetDeltaWaterLogsParams{
			UserID:          userID,
			ServerUpdatedAt: pgtype.Timestamptz{Time: sinceTime, Valid: true},
		})
		if err != nil {
			serverError(w, r, fmt.Errorf("query delta logs: %w", err), `{"error": "Failed to fetch updates"}`)
			return
		}
	} else {
		// Initial sync: the client has no sync token yet and its UI only ever
		// renders today's logs (older entries get pruned from IndexedDB), so we
		// bootstrap just the recent records rather than the full history. We lack
		// the client's timezone, so we widen the window to the UTC day ±1: a
		// client's local "today" can fall on the previous or next UTC day (offsets
		// span UTC-12..UTC+14), and this guarantees we capture every log that
		// could be today for them. The client re-prunes anything outside its own
		// local day right after syncing.
		startOfDay := time.Date(serverNow.Year(), serverNow.Month(), serverNow.Day(), 0, 0, 0, 0, time.UTC)
		windowStart := startOfDay.AddDate(0, 0, -1)
		windowEnd := startOfDay.AddDate(0, 0, 2)

		rangeLogs, err := qtx.GetWaterLogsInRange(ctx, dbgen.GetWaterLogsInRangeParams{
			UserID:     userID,
			LoggedAt:   pgtype.Timestamptz{Time: windowStart, Valid: true},
			LoggedAt_2: pgtype.Timestamptz{Time: windowEnd, Valid: true},
		})
		if err != nil {
			serverError(w, r, fmt.Errorf("query today's logs: %w", err), `{"error": "Failed to fetch today's logs"}`)
			return
		}

		// Map the range rows to the shared delta return type (identical fields).
		for _, l := range rangeLogs {
			dbLogs = append(dbLogs, dbgen.GetDeltaWaterLogsRow(l))
		}
	}

	// 5. Commit the transaction (All reads and writes succeeded)
	if err := tx.Commit(ctx); err != nil {
		serverError(w, r, fmt.Errorf("commit sync transaction: %w", err), `{"error": "Failed to finalize sync transaction"}`)
		return
	}

	// 6. Map the raw database records back to our clean API DTOs
	var outgoingLogs []api.WaterLog
	for _, dbLog := range dbLogs {
		outgoingLogs = append(outgoingLogs, api.WaterLog{
			ID:       dbLog.ID,
			AmountMl: dbLog.AmountMl,
			// Always emit UTC so the wire format is canonical ("...Z"), matching
			// the client and keeping the same instant byte-identical everywhere.
			LoggedAt:  dbLog.LoggedAt.Time.UTC(),
			IsDeleted: dbLog.IsDeleted,
		})
	}

	// 7. Send the successful JSON response
	writeJSON(w, http.StatusOK, api.SyncResponse{
		Changes:    outgoingLogs,
		ServerTime: serverNow, // The client will save this and use it as 'since' next time
	})
}
