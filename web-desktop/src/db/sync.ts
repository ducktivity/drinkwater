import { db } from './db'
import { apiClient, getRequestId } from './api'
import { getToken } from './token'
import { logger } from '../logger'

/**
 * The outcome of a sync attempt. `ok` is true on a successful round-trip. On a backend rejection, `requestId` carries the per-request id (when the response exposed one) so the UI can show the user a support code. Offline failures have no response and therefore no `requestId`.
 */
export interface SyncResult {
  ok: boolean
  requestId?: string
}

/**
 * Pushes unsynced local logs to the backend and merges back any changes from other devices. Resolves to `{ ok: true }` when the round-trip succeeds and `{ ok: false }` (optionally with a `requestId`) when the request is rejected or the device is offline, so callers (e.g. the manual refresh button) can reflect the outcome in the UI.
 */
export const syncEngine = async (): Promise<SyncResult> => {
  // The single sync gate: with no session token the user has no account, so the app stays 100% local and never calls the backend. Because every sync trigger (app load, regained connectivity, after each log change) funnels through here, this one check keeps the whole client offline-only until sign-in.
  if (!getToken()) {
    return { ok: false }
  }

  try {
    logger.log('🔄 Starting sync...')

    // 1. Get the last time we synced from local storage
    const lastSync = localStorage.getItem('last_sync_time')

    // 2. Fetch all locally created/modified logs that haven't been pushed yet
    const unsyncedLogs = await db.waterLogs
      .where('is_synced')
      .equals(0)
      .toArray()

    // Map them to exactly what the OpenAPI schema expects (remove the local-only flag)
    const payload = unsyncedLogs.map((log) => ({
      id: log.id,
      amount_ml: log.amount_ml,
      logged_at: log.logged_at,
      is_deleted: log.is_deleted,
    }))

    // 3. Make the type-safe API call to our Go backend
    const { data, error, response } = await apiClient.POST('/v1/sync', {
      params: {
        query: {
          since: lastSync || undefined,
        },
      },
      body: payload,
    })

    if (error) {
      const requestId = getRequestId(response)
      logger.error('❌ Sync API rejected the request:', error, { requestId })
      return { ok: false, requestId }
    }

    if (!data) return { ok: false, requestId: getRequestId(response) }

    // 4. Save incoming changes from OTHER devices into our local Dexie DB
    if (data.changes && data.changes.length > 0) {
      const incomingLogs = data.changes.map((change) => ({
        ...change,
        is_synced: 1, // It came from the server, so it's already synced
      }))

      await db.waterLogs.bulkPut(incomingLogs)
    }

    // 5. Update our local clock to match the server's truth
    if (data.server_time) {
      localStorage.setItem('last_sync_time', data.server_time)
    }
    logger.log(`✅ Sync complete! Server time: ${data.server_time}`)

    return { ok: true }
  } catch (err) {
    // If we are offline, fetch fails here. We just catch it silently. The user doesn't care, they are local-first! No response means no request id to surface.
    logger.warn('📶 Offline: Sync deferred until connection is restored.', err)
    return { ok: false }
  }
}
