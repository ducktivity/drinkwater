package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"drinkwater-backend/api"
	"drinkwater-backend/auth"
	"drinkwater-backend/database"
	"drinkwater-backend/database/dbgen"
	"drinkwater-backend/email"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// EmailSender delivers login codes. It is set once at startup from main and is
// safe for concurrent use. Like database.DB, it is a package-level dependency so
// handlers stay plain http.HandlerFunc values.
var EmailSender *email.Sender

const (
	// codeTTL is how long a login code stays valid after it is issued.
	codeTTL = 10 * time.Minute
	// resendCooldown throttles code requests per account to blunt email-bombing
	// and abuse: a new code is refused while the previous one is this fresh.
	resendCooldown = 60 * time.Second
	// maxCodeAttempts caps wrong guesses against a single code before it is
	// treated as burned, bounding brute-force of the 6-digit space.
	maxCodeAttempts = 5
)

// normalizeEmail validates and canonicalises an email address: it must parse as
// a single RFC 5322 address, and is lowercased so the UNIQUE constraint treats
// "Me@x.com" and "me@x.com" as one account. Returns ok=false when invalid.
func normalizeEmail(raw string) (string, bool) {
	addr, err := mail.ParseAddress(strings.TrimSpace(raw))
	if err != nil {
		return "", false
	}
	return strings.ToLower(addr.Address), true
}

// PostAuthRequest godoc
// @Summary      Request a login code
// @Description  Sends a 6-digit login code to the given email, creating the account if it does not yet exist. Always returns a generic acknowledgement so the endpoint cannot be used to probe which emails have accounts.
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        payload body      api.AuthRequestInput true "Email to send the login code to"
// @Success      200     {object}  api.MessageResponse  "Generic acknowledgement"
// @Failure      400     {object}  map[string]string    "Invalid request body or email"
// @Failure      429     {object}  map[string]string    "A code was requested too recently"
// @Failure      500     {object}  map[string]string    "Internal server or database error"
// @Router       /auth/request [post]
func PostAuthRequest(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var input api.AuthRequestInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		clientError(w, r, http.StatusBadRequest, fmt.Sprintf("decode auth request: %v", err), `{"error": "Invalid JSON payload"}`)
		return
	}
	defer r.Body.Close()

	addr, ok := normalizeEmail(input.Email)
	if !ok {
		clientError(w, r, http.StatusBadRequest, fmt.Sprintf("invalid email %q", input.Email), `{"error": "A valid email is required"}`)
		return
	}

	q := dbgen.New(database.DB)

	// Upsert the account so first-time emails get one transparently.
	user, err := q.UpsertUserByEmail(ctx, addr)
	if err != nil {
		serverError(w, r, fmt.Errorf("upsert user %q: %w", addr, err), `{"error": "Could not start login"}`)
		return
	}

	// Per-account cooldown: if the most recent still-valid code was issued within
	// the cooldown window, refuse rather than send another email.
	if latest, err := q.GetLatestActiveAuthCode(ctx, user.ID); err == nil {
		if time.Since(latest.CreatedAt.Time) < resendCooldown {
			clientError(w, r, http.StatusTooManyRequests, "code requested within cooldown", `{"error": "Please wait a moment before requesting another code"}`)
			return
		}
	} else if !errors.Is(err, pgx.ErrNoRows) {
		serverError(w, r, fmt.Errorf("check latest code: %w", err), `{"error": "Could not start login"}`)
		return
	}

	code, err := auth.GenerateCode()
	if err != nil {
		serverError(w, r, fmt.Errorf("generate login code: %w", err), `{"error": "Could not start login"}`)
		return
	}

	err = q.CreateAuthCode(ctx, dbgen.CreateAuthCodeParams{
		UserID:    user.ID,
		CodeHash:  auth.HashCode(code),
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().Add(codeTTL), Valid: true},
	})
	if err != nil {
		serverError(w, r, fmt.Errorf("store login code: %w", err), `{"error": "Could not start login"}`)
		return
	}

	if err := EmailSender.SendLoginCode(ctx, addr, code); err != nil {
		serverError(w, r, fmt.Errorf("send login code to %q: %w", addr, err), `{"error": "Could not send login email"}`)
		return
	}

	writeJSON(w, http.StatusOK, api.MessageResponse{Message: "If that email is valid, a code is on its way."})
}

// PostAuthVerify godoc
// @Summary      Verify a login code
// @Description  Exchanges a valid email + 6-digit code for a 30-day session token. Wrong guesses are capped per code; a successful verification consumes the code so it cannot be reused.
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        payload body      api.AuthVerifyInput true "Email and the 6-digit code"
// @Success      200     {object}  api.AuthResponse    "Session token and the authenticated user"
// @Failure      400     {object}  map[string]string   "Invalid request body or email"
// @Failure      401     {object}  map[string]string   "Code is wrong, expired, used up, or locked"
// @Failure      500     {object}  map[string]string   "Internal server or database error"
// @Router       /auth/verify [post]
func PostAuthVerify(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var input api.AuthVerifyInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		clientError(w, r, http.StatusBadRequest, fmt.Sprintf("decode auth verify: %v", err), `{"error": "Invalid JSON payload"}`)
		return
	}
	defer r.Body.Close()

	addr, ok := normalizeEmail(input.Email)
	if !ok {
		clientError(w, r, http.StatusBadRequest, fmt.Sprintf("invalid email %q", input.Email), `{"error": "A valid email is required"}`)
		return
	}

	q := dbgen.New(database.DB)

	// Look up the account. A missing user is reported with the same generic 401
	// as a wrong code so the endpoint can't be used to enumerate accounts.
	user, err := q.GetUserByEmail(ctx, addr)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			invalidCode(w, r, "no account for email")
			return
		}
		serverError(w, r, fmt.Errorf("get user %q: %w", addr, err), `{"error": "Could not verify code"}`)
		return
	}

	code, err := q.GetLatestActiveAuthCode(ctx, user.ID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			invalidCode(w, r, "no active code")
			return
		}
		serverError(w, r, fmt.Errorf("get active code: %w", err), `{"error": "Could not verify code"}`)
		return
	}

	// Treat an over-guessed code as burned without checking it further.
	if code.Attempts >= maxCodeAttempts {
		invalidCode(w, r, "code attempt limit reached")
		return
	}

	if !auth.CodeMatches(input.Code, code.CodeHash) {
		// Record the wrong guess so repeated attempts eventually lock the code.
		if err := q.IncrementAuthCodeAttempts(ctx, code.ID); err != nil {
			serverError(w, r, fmt.Errorf("increment code attempts: %w", err), `{"error": "Could not verify code"}`)
			return
		}
		invalidCode(w, r, "code mismatch")
		return
	}

	// Correct: spend the code so it cannot be replayed, then mint a session.
	if err := q.ConsumeAuthCode(ctx, code.ID); err != nil {
		serverError(w, r, fmt.Errorf("consume code: %w", err), `{"error": "Could not verify code"}`)
		return
	}

	token, err := auth.IssueToken(user.ID)
	if err != nil {
		serverError(w, r, fmt.Errorf("issue token: %w", err), `{"error": "Could not verify code"}`)
		return
	}

	writeJSON(w, http.StatusOK, api.AuthResponse{
		Token: token,
		User:  api.User{ID: user.ID, Email: user.Email},
	})
}

// GetMe godoc
// @Summary      Get the current user
// @Description  Returns the account for the supplied bearer token. Used by clients to validate a stored token on startup.
// @Tags         auth
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  api.User          "The authenticated user"
// @Failure      401  {object}  map[string]string "Missing or invalid token"
// @Failure      500  {object}  map[string]string "Internal server or database error"
// @Router       /auth/me [get]
func GetMe(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	userID, ok := auth.UserIDFromContext(ctx)
	if !ok {
		// RequireAuth guarantees this; guard anyway so a routing mistake fails closed.
		clientError(w, r, http.StatusUnauthorized, "no user in context", `{"error": "Authentication required"}`)
		return
	}

	user, err := dbgen.New(database.DB).GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Token is valid but the account is gone (e.g. deleted): treat as logged out.
			clientError(w, r, http.StatusUnauthorized, "user not found", `{"error": "Authentication required"}`)
			return
		}
		serverError(w, r, fmt.Errorf("get user by id: %w", err), `{"error": "Could not load account"}`)
		return
	}

	writeJSON(w, http.StatusOK, api.User{ID: user.ID, Email: user.Email})
}

// invalidCode returns the single generic 401 used for every "you may not log in"
// outcome (wrong code, expired, locked, unknown account) so the response never
// reveals which condition occurred.
func invalidCode(w http.ResponseWriter, r *http.Request, cause string) {
	clientError(w, r, http.StatusUnauthorized, cause, `{"error": "Invalid or expired code"}`)
}
