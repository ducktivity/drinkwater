import { db } from './db'
import { getTodayKey, toDateKey } from '../utils'

/**
 * Prunes stale water logs from the local IndexedDB store.
 *
 * The UI only ever renders today's logs, so any log from a previous day is dead
 * weight in IndexedDB once it has reached the server. This removes every log that
 * is both:
 *   - already synced (`is_synced === 1`, so the server is the source of truth), and
 *   - not from today (its local calendar day differs from today's).
 *
 * Unsynced logs (`is_synced === 0`) are always kept regardless of age, since they
 * still need to be pushed to the backend and would otherwise be lost. Today's logs
 * are kept so the dashboard and its derived totals stay intact.
 *
 * Safe to call repeatedly (e.g. on app load and after each sync); it is a no-op
 * when there is nothing stale to remove.
 *
 * @returns The number of log entries deleted.
 */
export async function cleanupSyncedStaleLogs(): Promise<number> {
  const today = getTodayKey()

  // Narrow to synced logs via the is_synced index, then drop anything not from
  // today. The day is derived by parsing the timestamp to its local calendar day
  // (not by slicing the ISO prefix), so UTC-stored logs near midnight aren't
  // misclassified — matching how todayLogs filters in App.tsx.
  const staleIds = await db.waterLogs
    .where('is_synced')
    .equals(1)
    .filter((log) => toDateKey(new Date(log.logged_at)) !== today)
    .primaryKeys()

  if (staleIds.length === 0) return 0

  await db.waterLogs.bulkDelete(staleIds)
  return staleIds.length
}
