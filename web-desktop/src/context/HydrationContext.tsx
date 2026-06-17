import {
  createContext,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type Accessor,
  type ParentProps,
} from 'solid-js'
import { liveQuery } from 'dexie'
import { db, type LocalWaterLog } from '../db/db'
import { syncEngine } from '../db/sync'
import { cleanupSyncedStaleLogs } from '../db/cleanup'
import { logger } from '../logger'
import { getTodayKey, toDateKey, compareLoggedAtDesc } from '../utils'
import { savePersistedState, loadPersistedState } from '../state/persistence'
import { useSettings } from './SettingsContext'

/** Live hydration data: today's logs, totals, and the active-bottle level. */
interface HydrationContextValue {
  /** All non-deleted water logs from the local IndexedDB database. */
  waterLogs: Accessor<LocalWaterLog[]>
  /** Today's individual water log entries, most recent first. */
  todayLogs: Accessor<LocalWaterLog[]>
  /** Total millilitres consumed today (logged + active bottle). */
  totalMlConsumedToday: Accessor<number>
  /** Current fill fraction of the active bottle (0 = empty, 1 = full). */
  fillFraction: Accessor<number>
  setFillFraction: (newFillFraction: number) => void
  /** The active bottle's level as of the last settled interaction. */
  settledFillFraction: Accessor<number>
  setSettledFillFraction: (newFillFraction: number) => void
  /** Live drag updates: move the bottle visual without touching the daily total. */
  handleFillFractionChange: (newFillFraction: number) => void
  /** Commits the resting level after a drag ends above the empty threshold. */
  handleDragSettled: () => void
}

const HydrationContext = createContext<HydrationContextValue>()

/** Provides the live water logs, today's totals, and active-bottle state. */
export function HydrationProvider(props: ParentProps) {
  const settings = useSettings()
  const initialState = loadPersistedState()

  // Live water logs from the local IndexedDB database
  const [waterLogs, setWaterLogs] = createSignal<LocalWaterLog[]>([])

  // Active-bottle interaction state
  const [fillFraction, setFillFraction] = createSignal(
    initialState.fillFraction,
  )
  // The active bottle's level as of the last settled interaction (drag release,
  // log, or cancel). Kept separate from fillFraction so the daily total folds in
  // the in-progress bottle only when dragging stops, not on every drag frame.
  const [settledFillFraction, setSettledFillFraction] = createSignal(
    initialState.fillFraction,
  )

  /**
   * Today's individual water log entries, most recent first.
   */
  const todayLogs = createMemo(() => {
    const today = getTodayKey()
    return waterLogs()
      .filter((log) => toDateKey(new Date(log.logged_at)) === today)
      .sort(compareLoggedAtDesc)
  })

  /**
   * Total millilitres consumed today: the sum of the live IndexedDB logs (so it
   * always reflects added, edited, and deleted entries) plus whatever has been
   * drunk from the active bottle since it was last settled. The active-bottle
   * portion uses settledFillFraction, so dragging the bottle only moves this
   * figure once the drag stops — not on every frame.
   */
  const totalMlConsumedToday = createMemo(() => {
    const loggedTotal = todayLogs().reduce((sum, log) => sum + log.amount_ml, 0)
    const activeBottleConsumed = Math.round(
      (1 - settledFillFraction()) * settings.bottleSize(),
    )
    return loggedTotal + activeBottleConsumed
  })

  /** Live drag updates: move the bottle visual only, without touching the daily total. */
  function handleFillFractionChange(newFillFraction: number) {
    setFillFraction(newFillFraction)
  }

  /**
   * Called when a drag ends above the empty threshold. Commits the resting level
   * so the partially-drunk active bottle folds into today's total, and persists it.
   */
  function handleDragSettled() {
    setSettledFillFraction(fillFraction())
    savePersistedState({ fillFraction: fillFraction() })
  }

  onMount(() => {
    // Subscribe to live changes in the local water log table
    const liveQuerySubscription = liveQuery(() =>
      db.waterLogs.filter((log) => !log.is_deleted).sortBy('logged_at'),
    ).subscribe({ next: setWaterLogs, error: logger.error })

    // Prune stale (non-today) synced logs that the UI never renders. Runs even
    // when offline, where the sync below would bail before its own cleanup step.
    cleanupSyncedStaleLogs().catch(logger.error)

    // Attempt an initial sync on app load
    syncEngine().catch(logger.error)

    // Re-sync whenever the device regains network connectivity
    const handleOnline = () => syncEngine().catch(logger.error)
    window.addEventListener('online', handleOnline)

    onCleanup(() => {
      liveQuerySubscription.unsubscribe()
      window.removeEventListener('online', handleOnline)
    })
  })

  const value: HydrationContextValue = {
    waterLogs,
    todayLogs,
    totalMlConsumedToday,
    fillFraction,
    setFillFraction,
    settledFillFraction,
    setSettledFillFraction,
    handleFillFractionChange,
    handleDragSettled,
  }

  return (
    <HydrationContext.Provider value={value}>
      {props.children}
    </HydrationContext.Provider>
  )
}

/** Accesses the hydration context. Throws if used outside its provider. */
export function useHydration() {
  const context = useContext(HydrationContext)
  if (!context) {
    throw new Error('useHydration must be used within a HydrationProvider')
  }
  return context
}
