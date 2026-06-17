package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/getsentry/sentry-go"
	"github.com/go-chi/httplog/v2"
)

// writeJSON writes a value as a JSON response with the given status code. It is
// the single success-path response writer shared by every handler so the
// Content-Type header, status code, and encoding stay consistent.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// clientError records a client-caused failure (4xx) and returns a JSON error to
// the caller. The cause is attached to the single request-summary line emitted
// by httplog rather than logged separately, so there is exactly one log line per
// request. Client faults are expected and are deliberately NOT reported to Sentry.
func clientError(w http.ResponseWriter, r *http.Request, status int, cause, clientJSON string) {
	httplog.LogEntrySetFields(r.Context(), map[string]interface{}{
		"error":        cause,
		"client_error": true,
	})
	http.Error(w, clientJSON, status)
}

// serverError records a server-side fault (5xx). It reports the error to Sentry
// (which captures the stack trace and groups the issue), links the resulting
// Sentry event to the request line via "sentry_id", and returns a JSON 500. The
// error is logged exactly once: as part of the request summary httplog emits at
// Error level for the 5xx status.
func serverError(w http.ResponseWriter, r *http.Request, err error, clientJSON string) {
	ctx := r.Context()
	fields := map[string]interface{}{"error": err.Error()}

	// CaptureException is a no-op when Sentry is unconfigured (empty DSN in dev),
	// in which case the hub has no client and returns a nil event id.
	if hub := sentry.GetHubFromContext(ctx); hub != nil {
		if eventID := hub.CaptureException(err); eventID != nil {
			fields["sentry_id"] = string(*eventID)
		}
	}

	httplog.LogEntrySetFields(ctx, fields)
	http.Error(w, clientJSON, http.StatusInternalServerError)
}
