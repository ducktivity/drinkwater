import { db } from './db'
import { apiClient } from './api'
import { cleanupSyncedStaleLogs } from './cleanup'

export const syncEngine = async () => {
  try {
    console.log('🔄 Starting sync...')

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
    const { data, error } = await apiClient.POST('/sync', {
      params: {
        query: {
          since: lastSync || undefined,
        },
      },
      body: payload,
    })

    if (error) {
      console.error('❌ Sync API rejected the request:', error)
      return
    }

    if (!data) return

    // // 4. We successfully pushed! Mark our local logs as synced
    // if (unsyncedLogs.length > 0) {
    //   await db.waterLogs.bulkPut(
    //     unsyncedLogs.map((log) => ({ ...log, is_synced: 1 })),
    //   )
    // }

    // 5. Save incoming changes from OTHER devices into our local Dexie DB
    if (data.changes && data.changes.length > 0) {
      const incomingLogs = data.changes.map((change) => ({
        ...change,
        is_synced: 1, // It came from the server, so it's already synced
      }))

      await db.waterLogs.bulkPut(incomingLogs)
    }

    // 6. Update our local clock to match the server's truth
    if (data.server_time) {
      localStorage.setItem('last_sync_time', data.server_time)
    }
    console.log(`✅ Sync complete! Server time: ${data.server_time}`)

    // 7. Now that local logs are confirmed on the server, drop stale (non-today)
    // synced entries so IndexedDB doesn't accumulate data the UI never renders.
    const removed = await cleanupSyncedStaleLogs()
    if (removed > 0) {
      console.log(`🧹 Cleaned up ${removed} stale synced log(s).`)
    }
  } catch (err) {
    // If we are offline, fetch fails here. We just catch it silently.
    // The user doesn't care, they are local-first!
    console.warn('📶 Offline: Sync deferred until connection is restored.', err)
  }
}
