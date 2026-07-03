import createClient from 'openapi-fetch'

/**
 * Client for the shared identity service (id.ducktvt.com), the suite-wide sole
 * issuer of login codes and session tokens. It is a *different origin* from the
 * Drinkwater app backend: the app's own `/auth/request` and `/auth/verify`
 * routes were removed, so passwordless login now talks to identity directly
 * (cross-origin, CORS-allowed), while token-authenticated calls like `/v1/auth/me`,
 * `/v1/sync`, `/v1/logs` stay on the app backend via {@link apiClient} in api.ts.
 *
 * Unlike the app backend, identity does not emit an OpenAPI schema into this
 * repo, so the request/response contract below is hand-written to mirror the
 * identity DTOs (see identity/backend/api/dto.go). Keep the two in sync.
 */
export interface paths {
  '/v1/auth/request': {
    /** Email a 6-digit login code, creating the account if it is new. */
    post: {
      requestBody: {
        content: {
          'application/json': { email: string }
        }
      }
      responses: {
        /** Deliberately vague acknowledgement (does not reveal account existence). */
        200: {
          content: { 'application/json': { message: string } }
        }
        /** Invalid email, rate-limited, or server error. */
        default: {
          content: { 'application/json': { error: string } }
        }
      }
    }
  }
  '/v1/auth/verify': {
    /** Exchange an email + code for a session token. */
    post: {
      requestBody: {
        content: {
          'application/json': { email: string; code: string }
        }
      }
      responses: {
        /** The session token plus the account it belongs to. */
        200: {
          content: {
            'application/json': {
              token: string
              user: { id: string; email: string }
            }
          }
        }
        /** Invalid/expired code, malformed body, or server error. */
        default: {
          content: { 'application/json': { error: string } }
        }
      }
    }
  }
}

// Identity's base URL is injected at build time via VITE_IDENTITY_BASE_URL.
// Production builds set it to id.ducktvt.com; local dev falls back to the Go
// identity server on localhost:8000 (its default PORT; the app backend is 8001).
const identityBaseUrl =
  import.meta.env.VITE_IDENTITY_BASE_URL ?? 'http://localhost:8000'

// A separate client from the app-backend apiClient: login is pre-auth, so it
// needs neither the bearer-token nor the 401-logout middleware that api.ts adds.
export const identityClient = createClient<paths>({
  baseUrl: identityBaseUrl,
})
