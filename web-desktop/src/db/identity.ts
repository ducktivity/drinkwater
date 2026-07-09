import { createClient } from '@ducktivity/identity-client'

/**
 * Client for the shared identity service (id.ducktvt.com), the suite-wide sole issuer of login codes and session tokens. It is a *different origin* from the Drinkwater app backend: passwordless login (`/v1/auth/request-code`, `/v1/auth/verify-code`) talks to identity directly (cross-origin, CORS-allowed), while token-authenticated calls like `/v1/auth/me`, `/v1/sync`, `/v1/logs` stay on the app backend via {@link apiClient} in api.ts.
 */

// Identity's base URL is injected at build time via VITE_IDENTITY_BASE_URL. Production builds set it to id.ducktvt.com; local dev falls back to the Go identity server on localhost:8000 (its default PORT; the app backend is 8001).
const identityBaseUrl =
  import.meta.env.VITE_IDENTITY_BASE_URL ?? 'http://localhost:8000'

export const identityClient = createClient(identityBaseUrl)
