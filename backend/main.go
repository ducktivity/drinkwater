package main

import (
	"drinkwater-backend/database"
	"log/slog"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	if err := godotenv.Load(); err != nil {
		// We use slog.Warn because in production (Coolify), there is no .env file
		// The environment variables are injected directly by the OS.
		slog.Warn("No .env file found or error loading it, relying on system environment variables")
	}

	database.Connect()

	// Initialize slog to output JSON to stdout (standard output)
	// Coolify will automatically collect these JSON logs
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo, // Set default logging level
	}))
	slog.SetDefault(logger)

	e := echo.New()

	// Crash-recovery middleware
	e.Use(middleware.Recover())

	// Configure Echo's built-in RequestLogger to pipe directly into our structured slog
	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogStatus:   true,
		LogURI:      true,
		LogMethod:   true,
		LogError:    true,
		LogLatency:  true,
		LogRemoteIP: true,
		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
			if v.Error != nil {
				slog.Error("request failed",
					"uri", v.URI,
					"method", v.Method,
					"status", v.Status,
					"error", v.Error.Error(),
					"latency", v.Latency,
					"ip", v.RemoteIP,
				)
			} else {
				slog.Info("request processed",
					"uri", v.URI,
					"method", v.Method,
					"status", v.Status,
					"latency", v.Latency,
					"ip", v.RemoteIP,
				)
			}
			return nil
		},
	}))

	e.GET("/health", func(c echo.Context) error {
		return c.String(http.StatusOK, "Drinkwater server is healthy")
	})

	// Start the server on port 8080
	slog.Info("Starting Drinkwater server",
		"port", 8080)
	if err := e.Start(":8080"); err != nil {
		slog.Error("failed to start server", "error", err)
		os.Exit(1)
	}
}
