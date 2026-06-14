package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"drinkwater-backend/api"
	"drinkwater-backend/database"
	"drinkwater-backend/database/dbgen"

	"github.com/go-chi/httplog/v2"
	"github.com/jackc/pgx/v5/pgtype"
)

// GetLogs godoc
// @Summary      Fetch water logs for a specific day
// @Description  Returns the non-deleted water logs whose logged_at falls within the half-open range [from, to). The client passes the start of the selected local day and the start of the following day so day boundaries honour the client's timezone. Used to view historical days that are no longer cached locally.
// @Tags         logs
// @Produce      json
// @Param        from  query     string            true   "ISO-8601 timestamp marking the inclusive start of the range"
// @Param        to    query     string            true   "ISO-8601 timestamp marking the exclusive end of the range"
// @Success      200   {object}  api.LogsResponse  "Logs within the requested range, most recent first"
// @Failure      400   {object}  map[string]string "Missing or invalid range parameters"
// @Failure      500   {object}  map[string]string "Internal server or database error"
// @Router       /logs [get]
func GetLogs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Stamp the request-summary line with the acting user (constant for now).
	httplog.LogEntrySetFields(ctx, map[string]interface{}{"user_id": dummyUserID.String()})

	// 1. Parse the half-open [from, to) range from the query string. Both bounds
	// are required so the query is always scoped to a single day.
	fromStr := r.URL.Query().Get("from")
	toStr := r.URL.Query().Get("to")
	if fromStr == "" || toStr == "" {
		clientError(w, r, http.StatusBadRequest, "missing 'from' or 'to' timestamp", `{"error": "Both 'from' and 'to' timestamps are required"}`)
		return
	}

	fromTime, err := time.Parse(time.RFC3339, fromStr)
	if err != nil {
		clientError(w, r, http.StatusBadRequest, fmt.Sprintf("invalid 'from' timestamp %q", fromStr), `{"error": "Invalid 'from' timestamp format"}`)
		return
	}

	toTime, err := time.Parse(time.RFC3339, toStr)
	if err != nil {
		clientError(w, r, http.StatusBadRequest, fmt.Sprintf("invalid 'to' timestamp %q", toStr), `{"error": "Invalid 'to' timestamp format"}`)
		return
	}

	// 2. Query the day's non-deleted logs for the (dummy) user.
	dbLogs, err := dbgen.New(database.DB).GetWaterLogsInRange(ctx, dbgen.GetWaterLogsInRangeParams{
		UserID:     dummyUserID,
		LoggedAt:   pgtype.Timestamptz{Time: fromTime, Valid: true},
		LoggedAt_2: pgtype.Timestamptz{Time: toTime, Valid: true},
	})
	if err != nil {
		serverError(w, r, fmt.Errorf("query logs in range: %w", err), `{"error": "Failed to fetch logs"}`)
		return
	}

	// 3. Map the raw database rows back to our clean API DTOs.
	logs := make([]api.WaterLog, 0, len(dbLogs))
	for _, dbLog := range dbLogs {
		logs = append(logs, api.WaterLog{
			ID:       dbLog.ID,
			AmountMl: dbLog.AmountMl,
			// Always emit UTC so the wire format is canonical ("...Z"), matching
			// the client and keeping the same instant byte-identical everywhere.
			LoggedAt:  dbLog.LoggedAt.Time.UTC(),
			IsDeleted: dbLog.IsDeleted,
		})
	}

	// 4. Send the successful JSON response.
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(api.LogsResponse{Logs: logs})
}
