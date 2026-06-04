package main

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	// Initialize the Echo v4 instance
	e := echo.New()

	// Use modern RequestLogger and crash-recovery middleware
	e.Use(middleware.RequestLogger())
	e.Use(middleware.Recover())

	// A simple health-check route (Notice: c echo.Context, no pointer!)
	e.GET("/health", func(c echo.Context) error {
		return c.String(http.StatusOK, "Drinkwater server is up and running!")
	})

	// Start the server on port 8080
	slog.Info("Starting Drinkwater server on http://localhost:8080")
	if err := e.Start(":8080"); err != nil {
		slog.Error("failed to start server", "error", err)
		os.Exit(1)
	}
}
