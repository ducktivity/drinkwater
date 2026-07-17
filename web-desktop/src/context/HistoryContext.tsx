import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
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

// Delay before the backend reconcile fetch fires after the selected day changes, so spam-clicking prev/next only queries the day the user settles on. See the reconcile effect for why we debounce rather than rely on request cancellation.
const RECONCILE_DEBOUNCE_MS = 300

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
   * Two phases so days appear instantly:
   *   1. Paint whatever is already in IndexedDB (all logs persist locally, plus any unsynced edits) immediately, on every navigation — no network, so spam-clicking prev/next stays responsive even while offline.
   *   2. Reconcile against the backend (authoritative for other-device edits), debounced so only the day the user settles on is fetched.
   *
   * The selected date is re-checked in each step (isStale) so a slow load can't clobber a newer selection.
   *
   * Why debounce rather than lean on request cancellation: the API sits behind Cloudflare, which does not forward a browser's fetch abort to the origin — so a superseded /v1/logs request would still run its DB query and burn egress even though the client already walked away. Debouncing means those superseded requests are never sent. The AbortController below still cancels the in-flight request on a direct (dev) connection, where the abort does reach the origin.
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

    // Phase 1 — instant, un-debounced paint from IndexedDB so the day's persisted logs (and unsynced changes) render immediately, even while offline.
    const localLogsPromise = readLocalLogsForDate(date)
    void localLogsPromise.then((localLogs) => {
      if (isStale()) return
      setHistoryLogs(localLogs)
      // Logged out, the app is local-only: there is no remote data to reconcile, so the local view is final — stop the spinner (Phase 2 is skipped below).
      if (!auth.isLoggedIn()) setIsLoadingHistory(false)
    })

    // Phase 2 is remote-only; while logged out we skip it entirely (it would 401 and surface a spurious error).
    if (!auth.isLoggedIn()) return

    // Debounce the backend reconcile, and cancel it (pending timer + in-flight fetch) as soon as a newer day is selected. Solid runs this cleanup before the effect re-executes, so spam-clicking prev/next (or jumping via the date picker) fires just one /v1/logs query — for the day the user lands on.
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const reconciled = await fetchLogsForDate(date, controller.signal)
          if (isStale()) return
          setHistoryLogs(reconciled)
        } catch (err) {
          // A superseded selection aborted this fetch — expected, not an error.
          if (controller.signal.aborted) return
          logger.error(err)
          if (isStale()) return
          // The local view is already on screen, so only surface an error when we had nothing local to show; otherwise a failed reconcile is silent.
          const localLogs = await localLogsPromise
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
    }, RECONCILE_DEBOUNCE_MS)

    onCleanup(() => {
      clearTimeout(timer)
      controller.abort()
    })
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
