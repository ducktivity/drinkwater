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
import { fetchLogsForDate } from '../db/history'
import { getTodayKey, compareLoggedAtDesc } from '../utils'
import { useHydration } from './HydrationContext'
import { useToast } from './ToastContext'

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
   * Total millilitres for the selected day. Today reuses the live total (which
   * folds in the active bottle); past days sum their fetched logs.
   */
  const selectedDayTotalMl = createMemo(() =>
    isViewingToday()
      ? hydration.totalMlConsumedToday()
      : historyLogs().reduce((sum, log) => sum + log.amount_ml, 0),
  )

  /**
   * Fetches a past day's logs whenever the user navigates to one, with a loading
   * state. Today needs no fetch — its logs come live from IndexedDB. The selected
   * date is re-checked in each callback so a slow fetch can't clobber a newer
   * selection (race guard).
   */
  createEffect(() => {
    const date = selectedDate()
    if (date === getTodayKey()) {
      setHistoryLogs([])
      setIsLoadingHistory(false)
      return
    }
    setIsLoadingHistory(true)
    fetchLogsForDate(date)
      .then((logs) => {
        if (selectedDate() === date) setHistoryLogs(logs)
      })
      .catch((err) => {
        console.error(err)
        if (selectedDate() === date) {
          setHistoryLogs([])
          if (!navigator.onLine) {
            toast.showToast(
              "You're offline — this day's logs can't be loaded right now.",
              'info',
            )
          } else {
            toast.showToast(
              "Couldn't load logs for this day. Please try again.",
              'error',
            )
          }
        }
      })
      .finally(() => {
        if (selectedDate() === date) setIsLoadingHistory(false)
      })
  })

  /**
   * Reflects a mutated log in the history list so past-day edits/additions show
   * immediately, without waiting for a re-fetch. A no-op when viewing today,
   * where the live query already drives the list. Deletions drop the entry;
   * edits and additions upsert it, keeping the list sorted most-recent-first.
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
