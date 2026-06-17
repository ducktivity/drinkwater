/**
 * Pure session-token storage with no other dependencies, so both the API client
 * (api.ts) and the auth helpers (auth.ts) can use it without an import cycle. The
 * token is the single switch between a signed-in, syncing client and an
 * anonymous, 100%-local one.
 */

const TOKEN_KEY = 'auth_token'

/**
 * Custom event api.ts dispatches when the server rejects our token (401) so the
 * auth context can drop back to a logged-out, local-only state.
 */
export const AUTH_LOGOUT_EVENT = 'auth:logout'

/** Returns the stored session token, or null when signed out. */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

/** Persists the session token after a successful verification. */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

/**
 * Clears the session token. Also drops the sync cursor so a different account
 * signing in next does not inherit this one's "last synced" timestamp.
 */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem('last_sync_time')
}
