import { getTodayKey } from '../utils'
import { DEFAULT_SCHEDULE, type ScheduleCheckpoint } from '../schedule'
import {
  DEFAULT_REMINDER_SETTINGS,
  type ReminderSettings as ReminderSettingsValue,
} from '../reminder'

/** localStorage key used to persist UI state between sessions. */
const HYDRATION_STORAGE_KEY = 'drinkwater_ui'

/** Shape of the persisted UI state stored in localStorage. */
export interface HydrationUIState {
  /** Bottle volume in ml configured by the user. */
  size: number
  /** Daily hydration goal in ml configured by the user. */
  goal: number
  /** Current fill fraction of the active bottle (0 = empty, 1 = full). */
  fillFraction: number
  /** Timed hydration checkpoints (deadlines + cumulative targets). */
  schedule: ScheduleCheckpoint[]
  /** Drink-water reminder settings (gentle cadence + force escalation). */
  reminder: ReminderSettingsValue
  /** The date this state belongs to, as a YYYY-MM-DD key. */
  date: string
}

/**
 * Reads persisted state from localStorage.
 * If the stored date differs from today, resets the active bottle's fill level
 * while keeping user settings (size, goal). Note that the amount drunk today is
 * derived from the IndexedDB logs, not from this UI state.
 */
export function loadPersistedState(): HydrationUIState {
  try {
    const serialized = localStorage.getItem(HYDRATION_STORAGE_KEY)
    if (serialized) {
      const parsed = JSON.parse(serialized) as HydrationUIState
      const today = getTodayKey()
      // Fall back to the default schedule for state persisted before the
      // schedule feature existed.
      const schedule = parsed.schedule ?? DEFAULT_SCHEDULE
      // Merge persisted reminder settings over the defaults so state saved
      // before the reminder feature existed (or missing newer fields) is filled.
      const reminder = { ...DEFAULT_REMINDER_SETTINGS, ...parsed.reminder }
      // New day — carry forward settings but reset the active bottle to full
      if (parsed.date !== today) {
        return {
          ...parsed,
          schedule,
          reminder,
          fillFraction: 1,
          date: today,
        }
      }
      return { ...parsed, schedule, reminder }
    }
  } catch {
    /* Ignore parse errors and fall through to defaults */
  }
  return {
    size: 1000,
    goal: 2000,
    fillFraction: 1,
    schedule: DEFAULT_SCHEDULE,
    reminder: DEFAULT_REMINDER_SETTINGS,
    date: getTodayKey(),
  }
}

// In-memory snapshot of the persisted state, seeded once from localStorage.
// Each savePersistedState call merges its slice in here so callers can persist
// just the fields they own while the full blob stays intact on disk.
let snapshot: HydrationUIState = loadPersistedState()

/**
 * Persists a partial slice of the UI state. The slice is merged into the
 * in-memory snapshot, stamped with today's date, and the full blob is written
 * to localStorage. This lets each context persist only the fields it owns
 * (e.g. `{ size }` or `{ fillFraction }`) without clobbering the others.
 */
export function savePersistedState(partial: Partial<HydrationUIState>) {
  snapshot = { ...snapshot, ...partial, date: getTodayKey() }
  localStorage.setItem(HYDRATION_STORAGE_KEY, JSON.stringify(snapshot))
}
