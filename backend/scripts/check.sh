#!/bin/bash
set -e
cd "$(dirname "$0")/.." # Always run from the backend root

echo "🎨 Formatting Go code..."
go fmt ./...

echo "🏗️ Building all packages..."
go build ./...

echo "🔍 Vetting for suspicious constructs..."
go vet ./...

echo "✅ Backend checks passed!"
