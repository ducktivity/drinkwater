package main

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"runtime/debug"
	"strings"
	"syscall"
	"time"

	"drinkwater-backend/auth"
	"drinkwater-backend/database"
	"drinkwater-backend/email"
	"drinkwater-backend/handlers"

	"github.com/getsentry/sentry-go"
	sentryhttp "github.com/getsentry/sentry-go/http"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httplog/v2"
	"github.com/joho/godotenv"
)

// Build information. Set at release time via the linker:
//
//	go build -ldflags "-X main.version=1.2.3 -X main.commit=$(git rev-parse HEAD)"
//
// When built without ldflags (local `go run`, `air`), resolveBuildInfo() fills
// these from the embedded VCS stamp so logs/Sentry still carry a commit.
var (
	version   = ""
	commit    = ""
	buildTime = ""
)

// config holds the runtime configuration sourced from environment variables.
type config struct {
	env          string     // ENV: prod | staging | development; tags every log + Sentry event
	port         string     // PORT: TCP port to listen on
	logLevel     slog.Level // LOG_LEVEL: debug | info | warn | error
	logJSON      bool       // LOG_FORMAT: "json" (prod) or "text" (local dev pretty output)
	sentryDSN    string     // SENTRY_DSN: empty disables Sentry (no-op) for local dev
	authSecret   string     // AUTH_JWT_SECRET: signs session JWTs and peppers login codes
	resendAPIKey string     // RESEND_API_KEY: empty logs login codes instead of emailing (dev)
	emailFrom    string     // AUTH_EMAIL_FROM: From header for login emails, e.g. "Drinkwater <login@example.com>"
}

func loadConfig() config {
	env := getenv("ENV", "development")
	// Local development defaults to pretty, trimmed text output; staging/prod
	// default to JSON so the log aggregator can parse it. An explicit LOG_FORMAT
	// still wins, so either format can be forced in any environment.
	defaultLogFormat := "json"
	if env == "development" {
		defaultLogFormat = "text"
	}
	return config{
		env:          env,
		port:         getenv("PORT", "8080"),
		logLevel:     httplog.LevelByName(getenv("LOG_LEVEL", "info")),
		logJSON:      getenv("LOG_FORMAT", defaultLogFormat) == "json",
		sentryDSN:    os.Getenv("SENTRY_DSN"),
		authSecret:   os.Getenv("AUTH_JWT_SECRET"),
		resendAPIKey: os.Getenv("RESEND_API_KEY"),
		emailFrom:    getenv("AUTH_EMAIL_FROM", "Drinkwater <onboarding@resend.dev>"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// @title Drinkwater Sync API
// @version 1.0
// @description Local-first sync engine.
// @BasePath /
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and the session token returned by /auth/verify.
func main() {
	resolveBuildInfo()

	// Load .env before reading config so local dev can supply secrets (auth,
	// Sentry, etc.) via the file. In prod, docker-compose injects these as real
	// env vars and there is no .env for the Go process, so Load is a silent no-op.
	godotenv.Load()
	cfg := loadConfig()

	// One logger powers everything: httplog uses it for per-request summaries,
	// and slog.SetDefault routes startup/shutdown/DB logs through the same
	// JSON-to-stdout pipeline. Concise mode emits exactly one summary line per
	// request (no separate request/response pair) to keep log volume — and the
	// BetterStack bill — minimal.
	logger := httplog.NewLogger("drinkwater-backend", httplog.Options{
		JSON:             cfg.logJSON,
		LogLevel:         cfg.logLevel,
		Concise:          true,
		MessageFieldName: "msg",
		// Health probes are hit constantly by the deploy agent and uptime
		// monitor; quiet them so they don't drown the logs.
		QuietDownRoutes: []string{"/healthz", "/readyz", "/health"},
		QuietDownPeriod: 1 * time.Hour,
	})
	// Base attributes ride on every line (request summaries, startup, DB) so a
	// log aggregator can filter by env/version/commit/pid. We attach them here
	// rather than via httplog's Tags option, which it drops in Concise mode.
	// In local text mode we skip them to keep each line short and readable —
	// they only earn their keep when logs are shipped somewhere queryable.
	if cfg.logJSON {
		logger.Logger = logger.Logger.With(
			"env", cfg.env,
			"version", version,
			"commit", shortCommit(commit),
			"pid", os.Getpid(),
		)
	}
	slog.SetDefault(logger.Logger)

	// Configure authentication. The secret signs session JWTs and peppers login
	// codes, so it must be present outside local dev; fail fast rather than boot
	// an instance that can mint forgeable tokens.
	if cfg.authSecret == "" {
		if cfg.env != "development" {
			slog.Error("AUTH_JWT_SECRET is required outside development")
			os.Exit(1)
		}
		slog.Warn("AUTH_JWT_SECRET is empty; using an insecure development default")
		cfg.authSecret = "dev-insecure-secret-do-not-use-in-prod"
	}
	auth.SetSecret(cfg.authSecret)

	// Wire the login-code email sender. With no RESEND_API_KEY (local dev) it logs
	// codes instead of sending them.
	handlers.EmailSender = email.NewSender(cfg.resendAPIKey, cfg.emailFrom)

	database.Connect()

	// Sentry captures stack traces, groups errors, and alerts. With an empty DSN
	// it is a no-op, so local dev needs no Sentry account.
	if cfg.sentryDSN != "" {
		if err := sentry.Init(sentry.ClientOptions{
			Dsn:              cfg.sentryDSN,
			Environment:      cfg.env,
			Release:          version + "+" + shortCommit(commit),
			AttachStacktrace: true,
			EnableTracing:    false, // errors only; we run no tracing backend
		}); err != nil {
			slog.Error("sentry init failed", "error", err)
		} else {
			defer sentry.Flush(2 * time.Second)
		}
	}

	router := chi.NewRouter()

	// Middleware order is outer -> inner. RealIP feeds httplog/Sentry; httplog
	// wraps everything so it records the final status (incl. the 500 written by
	// Recoverer). Sentry sits inside Recoverer with Repanic:true so a panic is
	// captured-with-stacktrace and then re-panicked up to Recoverer, which turns
	// it into a clean 500.
	//
	// We deliberately do NOT register middleware.RequestID ourselves: httplog's
	// RequestLogger already chains it internally and logs that id as "requestID".
	// Adding our own would assign a *different* id (advancing the counter twice
	// per request), so the id we echo to the client wouldn't match the logged one.
	router.Use(middleware.RealIP)
	router.Use(httplog.RequestLogger(logger))
	// Echo the request id onto the response so the frontend can show it to users
	// for support reports. This runs *after* RequestLogger so it reads the exact
	// id httplog generated and logged as "requestID" — keeping the user-visible
	// code and the log line in lockstep. chi's RequestID middleware only stashes
	// the id in the context; it never writes a response header, so we do it here.
	router.Use(echoRequestID)
	// Development only: attach the request body to each request summary so you can
	// see exactly what the client sent. Bodies can carry user data, so this never
	// runs in staging/prod. It must sit inside RequestLogger, which puts the log
	// entry into the request context for LogEntrySetField to find.
	if cfg.env == "development" {
		router.Use(devRequestBodyLogger)
	}
	router.Use(middleware.Recoverer)
	router.Use(sentryhttp.New(sentryhttp.Options{Repanic: true}).Handle)

	// The local dev server and the Tauri shell are always allowed; production
	// frontend origins (e.g. the Cloudflare Pages hostname on a different domain
	// than the API) are appended from CORS_ALLOWED_ORIGINS — a comma-separated
	// list set in the box's .env — so the deployed web app can call /sync.
	allowedOrigins := []string{"http://localhost:5173", "tauri://localhost"}
	if extra := os.Getenv("CORS_ALLOWED_ORIGINS"); extra != "" {
		for _, origin := range strings.Split(extra, ",") {
			if origin = strings.TrimSpace(origin); origin != "" {
				allowedOrigins = append(allowedOrigins, origin)
			}
		}
	}

	router.Use(cors.Handler(cors.Options{
		AllowedOrigins: allowedOrigins,
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type"},
		// Surface the per-request id (written by echoRequestID above) to the browser.
		// Browsers hide non-simple response headers from JS unless they're explicitly
		// exposed; without this the frontend can't read the id to show users for
		// support reports.
		ExposedHeaders: []string{"X-Request-Id"},
	}))

	// Liveness vs readiness: /healthz proves the process runs; /readyz proves it
	// can reach NeonDB (the deploy agent gates blue-green cutover on it).
	router.Get("/healthz", handlers.Healthz)
	router.Get("/readyz", handlers.Readyz)
	router.Get("/health", handlers.Healthz) // legacy alias

	// Public auth endpoints: request a login code and exchange it for a token.
	router.Post("/auth/request", handlers.PostAuthRequest)
	router.Post("/auth/verify", handlers.PostAuthVerify)

	// Everything that touches a user's data sits behind RequireAuth, which rejects
	// requests without a valid bearer token and injects the user id downstream.
	router.Group(func(r chi.Router) {
		r.Use(auth.RequireAuth)
		r.Get("/auth/me", handlers.GetMe)
		r.Post("/sync", handlers.PostSync)
		r.Get("/logs", handlers.GetLogs)
	})

	// Cancel the base context on SIGINT/SIGTERM so the server drains in-flight
	// requests cleanly during a blue-green cutover instead of dropping them.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	srv := &http.Server{Addr: ":" + cfg.port, Handler: router}

	go func() {
		slog.Info("starting Drinkwater server", "port", cfg.port, "env", cfg.env, "version", version, "commit", shortCommit(commit))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server failed", "error", err)
			stop() // unblock main so the process exits non-zero path below
		}
	}()

	<-ctx.Done()
	stop()
	slog.Info("shutdown signal received, draining connections")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("graceful shutdown failed", "error", err)
	}
	database.DB.Close()
	slog.Info("server stopped")
}

// resolveBuildInfo backfills empty ldflags-injected build vars from the Go
// toolchain's embedded VCS stamp, so a binary built with a plain `go build`
// still reports its commit and dirtiness.
func resolveBuildInfo() {
	bi, ok := debug.ReadBuildInfo()
	if !ok {
		return
	}
	if version == "" {
		version = bi.Main.Version // e.g. "(devel)" for local builds
	}
	for _, s := range bi.Settings {
		switch s.Key {
		case "vcs.revision":
			if commit == "" {
				commit = s.Value
			}
		case "vcs.time":
			if buildTime == "" {
				buildTime = s.Value
			}
		}
	}
	if version == "" {
		version = "dev"
	}
	if commit == "" {
		commit = "unknown"
	}
}

// devRequestBodyLogger reads the request body, attaches it to the httplog entry
// as "requestBody", and restores the body so downstream handlers still receive it
// intact. It is wired up only in development — we deliberately keep request bodies
// out of staging/prod logs since they can contain user data. The body is capped at
// maxBodyLog bytes in the log so a large sync payload can't flood the console; the
// handler always gets the full, untruncated body via the MultiReader below.
func devRequestBodyLogger(next http.Handler) http.Handler {
	const maxBodyLog = 4 << 10 // 4 KiB

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Body != nil && r.ContentLength != 0 {
			// Read up to the cap (+1 byte to detect truncation) without consuming
			// the rest, then splice the buffered prefix back in front of whatever
			// is left so the handler sees the complete body.
			prefix, err := io.ReadAll(io.LimitReader(r.Body, maxBodyLog+1))
			if err == nil {
				r.Body = io.NopCloser(io.MultiReader(bytes.NewReader(prefix), r.Body))

				logged := prefix
				if len(logged) > maxBodyLog {
					logged = logged[:maxBodyLog]
				}
				httplog.LogEntrySetField(r.Context(), "requestBody", slog.StringValue(string(logged)))
			}
		}
		next.ServeHTTP(w, r)
	})
}

// echoRequestID copies the chi request id into the X-Request-Id response header.
// It must run after httplog.RequestLogger (which internally runs middleware.RequestID
// and logs the id as "requestID") so the header carries the exact same id — letting
// support cross-reference a code the user reports against the exact log line. The
// header is set before the handler writes the body, so it survives even on error
// responses.
func echoRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if reqID := middleware.GetReqID(r.Context()); reqID != "" {
			w.Header().Set("X-Request-Id", reqID)
		}
		next.ServeHTTP(w, r)
	})
}

// shortCommit trims a git SHA to its first 12 characters for readable logs.
func shortCommit(c string) string {
	if len(c) > 12 {
		return c[:12]
	}
	return c
}
