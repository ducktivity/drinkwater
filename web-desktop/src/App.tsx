import { createSignal, createMemo, onMount, onCleanup, Show } from 'solid-js'
import { liveQuery } from 'dexie'
import { db, type LocalWaterLog } from './db/db'
import { syncEngine } from './db/sync'
import { getTodayKey } from './utils'
import { StatsRow } from './components/StatsRow'
import { BottleSection } from './components/BottleSection'
import { SettingsSection } from './components/SettingsSection'
import { HistoryList } from './components/HistoryList'
import { ConfirmOverlay } from './components/ConfirmOverlay'

/** localStorage key used to persist UI state between sessions. */
const HYDRATION_STORAGE_KEY = 'wt_v2'

/** Shape of the persisted UI state stored in localStorage. */
interface HydrationUIState {
  /** Bottle volume in ml configured by the user. */
  size: number
  /** Daily hydration goal in ml configured by the user. */
  goal: number
  /** Current fill fraction of the active bottle (0 = empty, 1 = full). */
  fillFraction: number
  /** Number of full bottles completed today. */
  completedBottleCount: number
  /** The date this state belongs to, as a YYYY-MM-DD key. */
  date: string
}

/**
 * Reads persisted state from localStorage.
 * If the stored date differs from today, resets the daily progress
 * (completedBottleCount and fillFraction) while keeping user settings (size, goal).
 */
function loadPersistedState(): HydrationUIState {
  try {
    const serialized = localStorage.getItem(HYDRATION_STORAGE_KEY)
    if (serialized) {
      const parsed = JSON.parse(serialized) as HydrationUIState
      const today = getTodayKey()
      // New day — carry forward settings but reset today's progress
      if (parsed.date !== today) {
        return { ...parsed, fillFraction: 1, completedBottleCount: 0, date: today }
      }
      return parsed
    }
  } catch {
    /* Ignore parse errors and fall through to defaults */
  }
  return {
    size: 1000,
    goal: 2000,
    fillFraction: 1,
    completedBottleCount: 0,
    date: getTodayKey(),
  }
}

export default function App() {
  const initialState = loadPersistedState()

  // User-configurable settings
  const [bottleSize, setBottleSize] = createSignal(initialState.size)
  const [dailyGoal, setDailyGoal] = createSignal(initialState.goal)

  // Active-bottle interaction state
  const [fillFraction, setFillFraction] = createSignal(initialState.fillFraction)
  const [completedBottleCount, setCompletedBottleCount] = createSignal(
    initialState.completedBottleCount,
  )

  // UI overlay state
  const [isConfirmVisible, setIsConfirmVisible] = createSignal(false)

  // Live water logs from the local IndexedDB database
  const [waterLogs, setWaterLogs] = createSignal<LocalWaterLog[]>([])

  /** Persists the current UI state snapshot to localStorage. */
  function persistState() {
    localStorage.setItem(
      HYDRATION_STORAGE_KEY,
      JSON.stringify({
        size: bottleSize(),
        goal: dailyGoal(),
        fillFraction: fillFraction(),
        completedBottleCount: completedBottleCount(),
        date: getTodayKey(),
      }),
    )
  }

  /**
   * Total millilitres consumed today: all completed bottles plus whatever
   * was already drunk from the active (partially-empty) bottle.
   */
  const totalMlConsumedToday = () =>
    Math.round(
      completedBottleCount() * bottleSize() + (1 - fillFraction()) * bottleSize(),
    )

  /**
   * Aggregated daily totals for the past 14 days (excluding today).
   * Returned as a date-descending array of [YYYY-MM-DD, totalMl] pairs.
   */
  const pastDailyHistory = createMemo(() => {
    const today = getTodayKey()
    const dailyTotals = new Map<string, number>()
    for (const log of waterLogs()) {
      const dateKey = log.logged_at.substring(0, 10)
      // Exclude today — it is displayed live in the stats row
      if (dateKey !== today) {
        dailyTotals.set(dateKey, (dailyTotals.get(dateKey) ?? 0) + log.amount_ml)
      }
    }
    return [...dailyTotals.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 14)
  })

  function handleFillFractionChange(newFillFraction: number) {
    setFillFraction(newFillFraction)
    persistState()
  }

  /** Called when the user drags the bottle to empty — triggers the confirm dialog. */
  function handleBottleEmptied() {
    setFillFraction(0)
    persistState()
    setIsConfirmVisible(true)
  }

  /** Commits the completed bottle to IndexedDB and kicks off a background sync. */
  async function handleLogConfirm() {
    await db.waterLogs.add({
      id: crypto.randomUUID(),
      amount_ml: bottleSize(),
      logged_at: new Date().toISOString(),
      is_deleted: false,
      is_synced: 0,
    })
    setCompletedBottleCount(completedBottleCount() + 1)
    setFillFraction(1)
    setIsConfirmVisible(false)
    persistState()
    syncEngine().catch(console.error)
  }

  /** Dismisses the confirm dialog and restores a near-empty bottle so the user can try again. */
  function handleLogCancel() {
    setFillFraction(0.05)
    setIsConfirmVisible(false)
    persistState()
  }

  onMount(() => {
    // Subscribe to live changes in the local water log table
    const liveQuerySubscription = liveQuery(() =>
      db.waterLogs.filter((log) => !log.is_deleted).sortBy('logged_at'),
    ).subscribe({ next: setWaterLogs, error: console.error })

    // Attempt an initial sync on app load
    syncEngine().catch(console.error)

    // Re-sync whenever the device regains network connectivity
    const handleOnline = () => syncEngine().catch(console.error)
    window.addEventListener('online', handleOnline)

    onCleanup(() => {
      liveQuerySubscription.unsubscribe()
      window.removeEventListener('online', handleOnline)
    })
  })

  const todayDisplayString = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div class="min-h-screen bg-[#0f1117] text-[#f0f2f7] font-sans flex flex-col items-center px-4 pt-6 pb-10">
      <header class="w-full max-w-105 mb-7">
        <div class="text-xl font-semibold tracking-tight">Hydration</div>
        <div class="text-[13px] text-[#7a7f96]">{todayDisplayString}</div>
      </header>

      <div class="w-full max-w-105 bg-[#1a1d26] border border-white/8 rounded-2xl pt-7 px-6 pb-6 flex flex-col items-center gap-6">
        <StatsRow
          totalMl={totalMlConsumedToday}
          completedBottleCount={completedBottleCount}
          fillFraction={fillFraction}
          goal={dailyGoal}
        />

        <BottleSection
          size={bottleSize}
          fillFraction={fillFraction}
          completedBottleCount={completedBottleCount}
          onFillFractionChange={handleFillFractionChange}
          onBottleEmptied={handleBottleEmptied}
        />

        <div class="w-full h-px bg-white/8" />

        <SettingsSection
          size={bottleSize}
          goal={dailyGoal}
          onSizeChange={(newSize) => {
            setBottleSize(newSize)
            persistState()
          }}
          onGoalChange={(newGoal) => {
            setDailyGoal(newGoal)
            persistState()
          }}
        />
      </div>

      <HistoryList history={pastDailyHistory} />

      <Show when={isConfirmVisible()}>
        <ConfirmOverlay
          size={bottleSize}
          onConfirm={handleLogConfirm}
          onCancel={handleLogCancel}
        />
      </Show>
    </div>
  )
}
