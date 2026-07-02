# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM golang:1.26-alpine AS build
WORKDIR /src

# Download dependencies first so this layer caches across source-only changes.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build metadata, supplied by docker-compose / CI from git. Injected into the
# binary via -ldflags so logs and Sentry report the exact running commit.
ARG VERSION=dev
ARG COMMIT=unknown
ARG BUILD_TIME=unknown

# CGO disabled -> a fully static binary that runs on a scratch/distroless image.
RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags="-s -w -X main.version=${VERSION} -X main.commit=${COMMIT} -X main.buildTime=${BUILD_TIME}" \
    -o /out/drinkwater ./

# ---- Runtime stage ----
# distroless/static ships CA certificates (needed for outbound TLS to NeonDB and
# Sentry) and runs as a non-root user, with no shell or package manager.
FROM gcr.io/distroless/static:nonroot
WORKDIR /app
COPY --from=build /out/drinkwater /app/drinkwater
EXPOSE 8001
USER nonroot:nonroot
ENTRYPOINT ["/app/drinkwater"]
