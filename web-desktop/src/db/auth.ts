import { apiClient } from './api'
import { setToken } from './token'

/**
 * The auth API calls (request code, verify code, who-am-I). Raw token storage
 * lives in token.ts; this module layers the network calls on top. Re-exported
 * here so callers have a single auth entry point.
 */
export { getToken, setToken, clearToken, AUTH_LOGOUT_EVENT } from './token'

/** The public shape of an authenticated account. */
export interface AuthUser {
  id: string
  email: string
}

/**
 * Asks the backend to email a 6-digit login code to `email`, creating the
 * account if it is new. Returns an error message on failure (e.g. rate-limited
 * or invalid email), or null on success.
 */
export async function requestCode(email: string): Promise<string | null> {
  const { error } = await apiClient.POST('/auth/request', {
    body: { email },
  })
  return error
    ? errorMessage(error, 'Could not send the code. Please try again.')
    : null
}

/**
 * Exchanges an email + code for a session token, persisting it on success.
 * Returns the authenticated user, or an error message string on failure.
 */
export async function verifyCode(
  email: string,
  code: string,
): Promise<{ user: AuthUser } | { error: string }> {
  const { data, error } = await apiClient.POST('/auth/verify', {
    body: { email, code },
  })
  if (error || !data) {
    return { error: errorMessage(error, 'That code is invalid or expired.') }
  }
  setToken(data.token)
  return { user: data.user }
}

/**
 * Validates a stored token by fetching the current account. Returns the user
 * when the token is still valid, or null when there is no token / it was
 * rejected (the 401 handler in api.ts clears it).
 */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const { data } = await apiClient.GET('/auth/me')
  return data ?? null
}

/** Pulls a human-readable message out of the backend's `{error}` body. */
function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'error' in error) {
    const message = (error as { error: unknown }).error
    if (typeof message === 'string') return message
  }
  return fallback
}
