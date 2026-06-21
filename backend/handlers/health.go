package handlers

import (
	"context"
	"net/http"
	"time"

	"drinkwater-backend/database"

	"github.com/go-chi/httplog/v2"
)

// Healthz is the liveness probe: it returns 200 whenever the process is
// running and checks no dependencies, so it stays cheap and never fails for a
// transient database blip. Intentionally undocumented in the OpenAPI spec — it
// is an operational endpoint, not part of the client-consumed API.
func Healthz(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

// Readyz is the readiness probe: it returns 200 only when the database is
// reachable, 503 otherwise. The deploy agent gates blue-green cutover on this
// probe so traffic is never sent to a color that cannot reach NeonDB.
// Intentionally undocumented in the OpenAPI spec — operational, not client-facing.
func Readyz(w http.ResponseWriter, r *http.Request) {
	// Keep the probe snappy; a hung database must not hang the probe.
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	if err := database.Ping(ctx); err != nil {
		// Attach the cause to the request line (httplog logs 503 at Error level).
		// We intentionally do NOT report this to Sentry: a database outage would
		// otherwise flood Sentry with one event per probe.
		httplog.LogEntrySetFields(r.Context(), map[string]interface{}{"error": err.Error()})
		http.Error(w, "not ready", http.StatusServiceUnavailable)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ready"))
}
