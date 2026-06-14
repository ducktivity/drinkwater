import { db, type LocalWaterLog } from './db'
import { apiClient } from './api'
import { compareLoggedAtDesc } from '../utils'

/**
 * Computes the half-open ISO range [from, to) that spans a single local calendar
 * day. `from` is local midnight of the given YYYY-MM-DD key and `to` is local
 * midnight of the following day, both serialised to UTC ISO strings so the
 * backend can compare them directly against the stored timestamps.
 */
function localDayRange(dateKey: string): { from: string; to: string } {
  const [year, month, day] = dateKey.split('-').map(Number)
  const start = new Date(year, month - 1, day, 0, 0, 0, 0)
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0)
  return { from: start.toISOString(), to: end.toISOString() }
}

/**
 * Fetches the water logs for a single local day for display in the history view.
 *
 * Historical (non-today) synced logs are pruned from IndexedDB, so the backend is
 * the source of truth for past days. We still merge in any logs that live locally
 * for that day — chiefly local edits/additions that haven't been pushed yet — so
 * unsynced changes remain visible even before the next sync completes. When an id
 * exists both locally and remotely, the local copy wins (it may hold a pending edit).
 *
 * Returns the day's non-deleted logs sorted most-recent-first.
 */
export async function fetchLogsForDate(
  dateKey: string,
): Promise<LocalWaterLog[]> {
  const { from, to } = localDayRange(dateKey)

  // Remote logs for the day (already-synced source of truth).
  const { data, error } = await apiClient.GET('/logs', {
    params: { query: { from, to } },
  })
  if (error) throw new Error('Failed to fetch logs for date')

  // Local logs for the day, including pending unsynced edits/additions.
  const localLogs = await db.waterLogs
    .where('logged_at')
    .between(from, to, true, false)
    .toArray()

  // Merge by id, letting the local copy override the remote one.
  const mergedById = new Map<string, LocalWaterLog>()
  for (const remote of data?.logs ?? []) {
    mergedById.set(remote.id, { ...remote, is_synced: 1 })
  }
  for (const local of localLogs) {
    mergedById.set(local.id, local)
  }

  return [...mergedById.values()]
    .filter((log) => !log.is_deleted)
    .sort(compareLoggedAtDesc)
}
