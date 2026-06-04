package database

import (
	"context"
	"log/slog"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DB holds our connection pool global instance
var DB *pgxpool.Pool

func Connect() {
	// Coolify will inject the database connection string via this environment variable
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		// Default fallback for running a local Postgres container
		connStr = "postgres://postgres:postgres@localhost:5432/drinkwater?sslmode=disable"
	}

	config, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		slog.Error("Unable to parse DATABASE_URL", "error", err)
		os.Exit(1)
	}

	// Configure pool settings for optimal performance
	config.MaxConns = 25
	config.MinConns = 5
	config.MaxConnIdleTime = 30 * time.Minute

	// Create the connection pool with a strict 5-second timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	DB, err = pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		slog.Error("Unable to create database connection pool", "error", err)
		os.Exit(1)
	}

	// Ping the database to ensure connection is actually alive
	if err := DB.Ping(ctx); err != nil {
		slog.Error("Database ping failed, server unreachable", "error", err)
		os.Exit(1)
	}

	slog.Info("Successfully connected to PostgreSQL database connection pool")
}
