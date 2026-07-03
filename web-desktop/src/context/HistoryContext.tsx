import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  useContext,
  type Accessor,
  type ParentProps,
} from 'solid-js'
import { type LocalWaterLog } from '../db/db'
import { fetchLogsForDate, readLocalLogsForDate } from '../db/history'
import { RequestError } from '../db/api'
import { getTodayKey, compareLoggedAtDesc } from '../utils'
import { useHydration } from './HydrationContext'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { logger } from '../logger'

/** History view: the day being viewed and its logs (today live, past fetched). */
interface HistoryContextValue {
  /** The day currently being viewed, as a YYYY-MM-DD key. */
  selectedDate: Accessor<string>
  setSelectedDate: (dateKey: string) => void
  /** Whether the user is viewing today (vs. a historical day). */
  isViewingToday: Accessor<boolean>
  /** The log entries shown in the list: today's live logs, or a fetched past day. */
  displayedLogs: Accessor<LocalWaterLog[]>
  /** Total millilitres for the selected day. */
  selectedDayTotalMl: Accessor<number>
  /** Whether a past day's logs are currently being fetched. */
  isLoadingHistory: Accessor<boolean>
  /** Reflects a mutated log in the history list (no-op when viewing today). */
  syncHistoryView: (changed: LocalWaterLog) => void
}

const HistoryContext = createContext<HistoryContextValue>()

/** Provides the history view state for navigating and editing past days. */
export function HistoryProvider(props: ParentProps) {
  const hydration = useHydration()
  const auth = useAuth()
  const toast = useToast()

  // The day currently being viewed, as a YYYY-MM-DD key. Defaults to today.
  const [selectedDate, setSelectedDate] = createSignal(getTodayKey())
  // Logs fetched for a past day (today's logs come from the live query instead).
  const [historyLogs, setHistoryLogs] = createSignal<LocalWaterLog[]>([])
  // Whether a past day's logs are currently being fetched from the backend.
  const [isLoadingHistory, setIsLoadingHistory] = createSignal(false)

  /** Whether the user is viewing today (vs. a historical day). */
  const isViewingToday = () => selectedDate() === getTodayKey()

  /** The log entries shown in the list: today's live logs, or a fetched past day. */
  const displayedLogs = createMemo(() =>
    isViewingToday() ? hydration.todayLogs() : historyLogs(),
  )

  /**
   * Total millilitres for the selected day. Today reuses the live total (which folds in the active bottle); past days sum their fetched logs.
   */
  const selectedDayTotalMl = createMemo(() =>
    isViewingToday()
      ? hydration.totalMlConsumedToday()
      : historyLogs().reduce((sum, log) => sum + log.amount_ml, 0),
  )

  /**
   * Loads a past day's logs whenever the user navigates to one. Today needs no load — its logs come live from IndexedDB.
   *
   * Two-phase so recent/offline days appear instantly: first paint whatever is already in IndexedDB (local retention window plus any unsynced edits), then reconcile against the backend (authoritative for pruned/other-device logs). The selected date is re-checked in each step so a slow load can't clobber a newer selection (race guard).
   */
  createEffect(() => {
    const date = selectedDate()
    if (date === getTodayKey()) {
      setHistoryLogs([])
      setIsLoadingHistory(false)
      return
    }

    const isStale = () => selectedDate() !== date
    setIsLoadingHistory(true)

    void (async () => {
      // Phase 1 — instant paint from IndexedDB so logs within the retention window (and unsynced changes) render immediately, even while offline.
      const localLogs = await readLocalLogsForDate(date)
      if (isStale()) return
      setHistoryLogs(localLogs)

      // Phase 2 — reconcile against the backend, the source of truth for days already pruned from IndexedDB and for changes from other devices. Only logged-in users have remote data; while logged out the app is local-only, so skip the fetch entirely (it would 401 and surface a spurious error).
      if (!auth.isLoggedIn()) {
        setIsLoadingHistory(false)
        return
      }

      try {
        const reconciled = await fetchLogsForDate(date)
        if (isStale()) return
        setHistoryLogs(reconciled)
      } catch (err) {
        logger.error(err)
        if (isStale()) return
        // The local view is already on screen, so only surface an error when we had nothing local to show; otherwise a failed reconcile is silent.
        if (localLogs.length === 0) {
          if (!navigator.onLine) {
            toast.showToast(
              "You're offline — this day's logs can't be loaded right now.",
              'info',
            )
          } else {
            // Surface the backend request id (when present) as a support code.
            const requestId =
              err instanceof RequestError ? err.requestId : undefined
            toast.showToast(
              "Couldn't load logs for this day. Please try again.",
              'error',
              requestId,
            )
          }
        }
      } finally {
        if (!isStale()) setIsLoadingHistory(false)
      }
    })()
  })

  /**
   * Reflects a mutated log in the history list so past-day edits/additions show immediately, without waiting for a re-fetch. A no-op when viewing today, where the live query already drives the list. Deletions drop the entry; edits and additions upsert it, keeping the list sorted most-recent-first.
   */
  function syncHistoryView(changed: LocalWaterLog) {
    if (isViewingToday()) return
    setHistoryLogs((prev) => {
      const without = prev.filter((log) => log.id !== changed.id)
      if (changed.is_deleted) return without
      return [...without, changed].sort(compareLoggedAtDesc)
    })
  }

  const value: HistoryContextValue = {
    selectedDate,
    setSelectedDate,
    isViewingToday,
    displayedLogs,
    selectedDayTotalMl,
    isLoadingHistory,
    syncHistoryView,
  }

  return (
    <HistoryContext.Provider value={value}>
      {props.children}
    </HistoryContext.Provider>
  )
}

/** Accesses the history context. Throws if used outside its provider. */
export function useHistory() {
  const context = useContext(HistoryContext)
  if (!context) {
    throw new Error('useHistory must be used within a HistoryProvider')
  }
  return context
}
