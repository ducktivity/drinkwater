import { db } from './db'
import { getTodayKey, toDateKey, shiftDateKey } from '../utils'

/**
 * Number of most-recent local calendar days (including today) whose synced logs
 * are retained in IndexedDB. Days inside this window render instantly from the
 * local store and stay available offline; synced logs older than the window are
 * pruned and re-fetched from the backend on demand.
 */
export const LOCAL_RETENTION_DAYS = 7

/**
 * Prunes stale water logs from the local IndexedDB store.
 *
 * The history view only navigates a short window of recent days, so synced logs
 * older than {@link LOCAL_RETENTION_DAYS} are dead weight once the server holds
 * them. This removes every log that is both:
 *   - already synced (`is_synced === 1`, so the server is the source of truth), and
 *   - older than the retention window (its local calendar day is before the cutoff).
 *
 * Unsynced logs (`is_synced === 0`) are always kept regardless of age, since they
 * still need to be pushed to the backend and would otherwise be lost. Logs within
 * the retention window are kept so recent days (and today's derived totals) render
 * instantly and remain visible offline.
 *
 * Safe to call repeatedly (e.g. on app load and after each sync); it is a no-op
 * when there is nothing stale to remove.
 *
 * @returns The number of log entries deleted.
 */
export async function cleanupSyncedStaleLogs(): Promise<number> {
  // Earliest local calendar day we still keep: today minus the retention window.
  // Date keys are zero-padded YYYY-MM-DD, so lexical comparison matches date order.
  const cutoffKey = shiftDateKey(getTodayKey(), -(LOCAL_RETENTION_DAYS - 1))

  // Narrow to synced logs via the is_synced index, then drop anything older than
  // the cutoff. The day is derived by parsing the timestamp to its local calendar
  // day (not by slicing the ISO prefix), so UTC-stored logs near midnight aren't
  // misclassified — matching how todayLogs filters in App.tsx.
  const staleIds = await db.waterLogs
    .where('is_synced')
    .equals(1)
    .filter((log) => toDateKey(new Date(log.logged_at)) < cutoffKey)
    .primaryKeys()

  if (staleIds.length === 0) return 0

  await db.waterLogs.bulkDelete(staleIds)
  return staleIds.length
}
