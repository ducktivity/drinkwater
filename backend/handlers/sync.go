package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"drinkwater-backend/api"
	"drinkwater-backend/database"
	"drinkwater-backend/database/dbgen"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// We use a dummy user ID until JWT authentication is implemented
var dummyUserID = uuid.MustParse("00000000-0000-0000-0000-000000000000")

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
// @Router       /sync [post]
func PostSync(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 1. Decode the standard JSON body directly into our API DTO
	var incomingLogs []api.WaterLog
	if err := json.NewDecoder(r.Body).Decode(&incomingLogs); err != nil {
		slog.Error("Failed to decode sync payload", "error", err)
		http.Error(w, `{"error": "Invalid JSON payload"}`, http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Capture the exact server time for this sync event
	serverNow := time.Now().UTC()

	// 2. Begin a Database Transaction
	tx, err := database.DB.Begin(ctx)
	if err != nil {
		slog.Error("Failed to begin database transaction", "error", err)
		http.Error(w, `{"error": "Database connection failed"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Attach sqlc to our active transaction
	qtx := dbgen.New(tx)

	// 3. Process Incoming Changes (Type-safe Upsert)
	for _, log := range incomingLogs {
		err := qtx.UpsertWaterLog(ctx, dbgen.UpsertWaterLogParams{
			ID:              log.ID,
			UserID:          dummyUserID,
			AmountMl:        log.AmountMl,
			LoggedAt:        pgtype.Timestamptz{Time: log.LoggedAt, Valid: true},
			IsDeleted:       log.IsDeleted,
			ServerUpdatedAt: pgtype.Timestamptz{Time: serverNow, Valid: true}, // Enforce the server's truth
		})

		if err != nil {
			slog.Error("Failed to upsert water log", "log_id", log.ID, "error", err)
			http.Error(w, `{"error": "Failed to save local changes"}`, http.StatusInternalServerError)
			return
		}
	}

	// 4. Fetch the Delta (What changed on OTHER devices?)
	var dbLogs []dbgen.GetAllWaterLogsRow
	sinceStr := r.URL.Query().Get("since")

	if sinceStr != "" {
		// Client provided a sync token, parse it and fetch only new records
		sinceTime, err := time.Parse(time.RFC3339, sinceStr)
		if err != nil {
			slog.Warn("Invalid since timestamp provided", "since", sinceStr)
			http.Error(w, `{"error": "Invalid since timestamp format"}`, http.StatusBadRequest)
			return
		}

		deltaLogs, err := qtx.GetDeltaWaterLogs(ctx, dbgen.GetDeltaWaterLogsParams{
			UserID:          dummyUserID,
			ServerUpdatedAt: pgtype.Timestamptz{Time: sinceTime, Valid: true},
		})
		if err != nil {
			slog.Error("Failed to query delta logs", "error", err)
			http.Error(w, `{"error": "Failed to fetch updates"}`, http.StatusInternalServerError)
			return
		}

		// Map the specific delta rows to the shared return type
		for _, l := range deltaLogs {
			dbLogs = append(dbLogs, dbgen.GetAllWaterLogsRow(l))
		}
	} else {
		// Initial sync: fetch all non-deleted records for this user
		var err error
		dbLogs, err = qtx.GetAllWaterLogs(ctx, dummyUserID)
		if err != nil {
			slog.Error("Failed to query all logs", "error", err)
			http.Error(w, `{"error": "Failed to fetch full history"}`, http.StatusInternalServerError)
			return
		}
	}

	// 5. Commit the transaction (All reads and writes succeeded)
	if err := tx.Commit(ctx); err != nil {
		slog.Error("Failed to commit sync transaction", "error", err)
		http.Error(w, `{"error": "Failed to finalize sync transaction"}`, http.StatusInternalServerError)
		return
	}

	// 6. Map the raw database records back to our clean API DTOs
	var outgoingLogs []api.WaterLog
	for _, dbLog := range dbLogs {
		outgoingLogs = append(outgoingLogs, api.WaterLog{
			ID:        dbLog.ID,
			AmountMl:  dbLog.AmountMl,
			LoggedAt:  dbLog.LoggedAt.Time,
			IsDeleted: dbLog.IsDeleted,
		})
	}

	// 7. Send the successful JSON response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(api.SyncResponse{
		Changes:    outgoingLogs,
		ServerTime: serverNow, // The client will save this and use it as 'since' next time
	})
}
