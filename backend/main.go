package main

import (
	"log/slog"
	"net/http"
	"os"

	"drinkwater-backend/database"
	"drinkwater-backend/handlers"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
)

// @title Drinkwater Sync API
// @version 1.0
// @description Local-first sync engine.
// @BasePath /
func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	godotenv.Load()
	database.Connect()

	// Initialize Chi router
	router := chi.NewRouter()

	// Add standard standard middleware
	router.Use(middleware.RequestID)
	router.Use(middleware.RealIP)
	router.Use(middleware.Logger)
	router.Use(middleware.Recoverer)

	// Configure CORS for SolidJS and Tauri
	router.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"http://localhost:5173", "tauri://localhost"},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type"},
	}))

	// Routes
	router.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Drinkwater Chi server is healthy"))
	})

	router.Post("/sync", handlers.PostSync)

	slog.Info("Starting Drinkwater server", "port", 8080)
	if err := http.ListenAndServe(":8080", router); err != nil {
		slog.Error("server startup failed", "error", err)
		os.Exit(1)
	}
}
