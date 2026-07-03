import { apiClient, getRequestId, RequestError } from './api'
import { getToken } from './token'
import { logger } from '../logger'
import { type HydrationUIState } from '../state/persistence'

/**
 * The subset of UI state that is account-bound and synced to the backend. The per-day ephemeral fields (`fillFraction`, `date`) are deliberately excluded — they are local-only daily state, not user settings.
 */
export type SyncableSettings = Pick<
  HydrationUIState,
  'size' | 'goal' | 'schedule' | 'reminder'
>

/**
 * Fetches the user's saved settings document from the backend.
 *
 * Returns the document when the account has saved settings, and `null` only when the server *definitively* reports there are none yet (HTTP 404) — that null is the caller's cue to seed the account from its local settings.
 *
 * Any non-definitive failure (offline, 401, 5xx, …) is rethrown rather than collapsed to null, so the caller can leave local state untouched instead of either overwriting it or seeding over settings that may actually exist on the server but were unreachable this time.
 */
export async function fetchSettings(): Promise<SyncableSettings | null> {
  // Same gate as the sync engine: no session token means a 100%-local client. Throw (rather than return null) so a caller never mistakes "not signed in" for "signed in with no settings" and seeds spuriously.
  if (!getToken()) {
    throw new RequestError('Not signed in')
  }

  // An offline fetch rejects here and propagates to the caller untouched.
  const { data, error, response } = await apiClient.GET('/v1/settings')

  // Definitive "no settings yet" → signal the caller to seed from local.
  if (response.status === 404) return null

  if (error || !data) {
    // Non-definitive failure: surface it so the caller leaves local state as-is.
    throw new RequestError('Failed to load settings', getRequestId(response))
  }

  // The backend stores the document verbatim, so `settings` is exactly the SyncableSettings object we sent. The generated type models it as an opaque object, hence the assertion.
  return data.settings as unknown as SyncableSettings
}

/**
 * Pushes the user's settings document to the backend, best-effort. Mirrors the sync engine: gated on a session token and silent on offline failures, since the local copy stays the source of truth until the next successful push.
 */
export async function pushSettings(settings: SyncableSettings): Promise<void> {
  if (!getToken()) return

  try {
    const { error, response } = await apiClient.PUT('/v1/settings', {
      // The settings document is opaque server-side; assert past the generated empty-object type so we can send the real object.
      body: { settings: settings as unknown as Record<string, never> },
    })
    if (error) {
      logger.error('❌ Could not save settings:', error, {
        requestId: getRequestId(response),
      })
    }
  } catch (err) {
    logger.warn('📶 Offline: settings save deferred.', err)
  }
}
