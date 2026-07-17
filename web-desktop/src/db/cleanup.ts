import { db, type LocalWaterLog } from './db'
import { getTodayKey, toDateKey } from '../utils'

/**
 * The subset of local logs that can be safely dropped from IndexedDB to free space: already-synced logs (`is_synced === 1`, so the server holds them) from a day before today.
 *
 * Unsynced logs (`is_synced === 0`) are never included — they still need to be pushed to the backend and would otherwise be lost. Today's logs are kept regardless of sync state so the live "today" view (which reads straight from IndexedDB) is never disturbed. Days cleared this way re-download from the backend on demand when the user navigates to them.
 */
async function reclaimableLogs(): Promise<LocalWaterLog[]> {
  const todayKey = getTodayKey()

  // Narrow to synced logs via the is_synced index, then keep only those whose local calendar day is before today. The day is derived by parsing the timestamp to its local calendar day (not by slicing the ISO prefix), so UTC-stored logs near midnight aren't misclassified.
  return db.waterLogs
    .where('is_synced')
    .equals(1)
    .filter((log) => toDateKey(new Date(log.logged_at)) < todayKey)
    .toArray()
}

/** An estimate of how much local storage a cleanup would reclaim. */
export interface ReclaimableStorage {
  /** Number of log entries that can be dropped. */
  count: number
  /** Estimated bytes those entries occupy. */
  bytes: number
}

/**
 * Estimates the local storage reclaimable by {@link clearSyncedLocalLogs}, so the UI can show the user how much space a cleanup would free. The byte figure is an approximation from each row's serialised size (the actual on-disk footprint includes IndexedDB overhead we don't try to measure).
 */
export async function estimateReclaimableStorage(): Promise<ReclaimableStorage> {
  const logs = await reclaimableLogs()
  return { count: logs.length, bytes: estimateBytes(logs) }
}

/**
 * Frees local storage by deleting already-synced past-day logs from IndexedDB (see {@link reclaimableLogs} for exactly which rows qualify and why the rest are kept). Intended to run only after a successful sync, so nothing is dropped before the server holds it.
 *
 * @returns The number of entries removed and an estimate of the bytes freed.
 */
export async function clearSyncedLocalLogs(): Promise<ReclaimableStorage> {
  const logs = await reclaimableLogs()
  const result = { count: logs.length, bytes: estimateBytes(logs) }

  if (logs.length > 0) {
    await db.waterLogs.bulkDelete(logs.map((log) => log.id))
  }
  return result
}

/** Approximates the storage footprint of the given logs from their serialised size. */
function estimateBytes(logs: LocalWaterLog[]): number {
  return logs.reduce((sum, log) => sum + JSON.stringify(log).length, 0)
}
