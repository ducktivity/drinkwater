import {
  createContext,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type Accessor,
  type ParentProps,
} from 'solid-js'
import { createStore } from 'solid-js/store'
import { type ScheduleCheckpoint } from '../schedule'
import {
  createReminderEngine,
  ensureNotificationPermission,
  type ReminderSettings as ReminderSettingsValue,
} from '../reminder'
import { loadPersistedState, savePersistedState } from '../state/persistence'
import { logger } from '../logger'

/** Configurable user settings: bottle size, daily goal, schedule, reminder. */
interface SettingsContextValue {
  /** Bottle volume in ml. */
  bottleSize: Accessor<number>
  /** Daily hydration goal in ml. */
  dailyGoal: Accessor<number>
  /** Timed hydration schedule (deadlines + cumulative targets). */
  schedule: Accessor<ScheduleCheckpoint[]>
  /** Drink-water reminder settings. */
  reminder: Accessor<ReminderSettingsValue>
  /** Ticking clock that drives schedule status (next goal / behind warnings). */
  now: Accessor<Date>
  setBottleSize: (newSize: number) => void
  setDailyGoal: (newGoal: number) => void
  updateCheckpoint: (id: string, changes: Partial<ScheduleCheckpoint>) => void
  removeCheckpoint: (id: string) => void
  addCheckpoint: () => void
  changeReminder: (changes: Partial<ReminderSettingsValue>) => void
}

const SettingsContext = createContext<SettingsContextValue>()

/** Provides the configurable user settings and persists changes to localStorage. */
export function SettingsProvider(props: ParentProps) {
  const initialState = loadPersistedState()

  const [bottleSize, setBottleSizeSignal] = createSignal(initialState.size)
  const [dailyGoal, setDailyGoalSignal] = createSignal(initialState.goal)
  // Timed hydration schedule (deadlines + cumulative targets). Held in a store
  // (not a signal) so edits mutate a single checkpoint field in place. This
  // keeps each checkpoint's object reference stable, so the editor's <For> rows
  // are reused rather than recreated on every keystroke — which is what keeps
  // the time/amount inputs from losing focus mid-edit.
  const [schedule, setSchedule] = createStore<ScheduleCheckpoint[]>(
    initialState.schedule,
  )
  // Drink-water reminder settings (gentle cadence + force escalation).
  const [reminder, setReminder] = createSignal(initialState.reminder)

  // Ticking clock that drives schedule status (next goal / behind warnings).
  // Updated periodically so deadlines flip from "upcoming" to "missed" without
  // requiring user interaction.
  const [now, setNow] = createSignal(new Date())

  function setBottleSize(newSize: number) {
    setBottleSizeSignal(newSize)
    savePersistedState({ size: newSize })
  }

  function setDailyGoal(newGoal: number) {
    setDailyGoalSignal(newGoal)
    savePersistedState({ goal: newGoal })
  }

  /**
   * Updates a single field of one checkpoint in place. Using the store's
   * path syntax (predicate + key + value) means only the targeted field
   * changes, so the checkpoint's object identity — and the editor row bound to
   * it — survives the edit instead of being recreated.
   */
  function updateCheckpoint(id: string, changes: Partial<ScheduleCheckpoint>) {
    for (const [key, value] of Object.entries(changes)) {
      setSchedule(
        (checkpoint) => checkpoint.id === id,
        key as keyof ScheduleCheckpoint,
        value as never,
      )
    }
    savePersistedState({ schedule })
  }

  /** Removes a checkpoint from the schedule. */
  function removeCheckpoint(id: string) {
    setSchedule((prev) => prev.filter((checkpoint) => checkpoint.id !== id))
    savePersistedState({ schedule })
  }

  /** Appends a new midday checkpoint the user can then adjust. */
  function addCheckpoint() {
    setSchedule((prev) => [
      ...prev,
      { id: crypto.randomUUID(), time: '12:00', targetMl: 1000 },
    ])
    savePersistedState({ schedule })
  }

  /**
   * Applies a partial change to the reminder settings. When the reminder is
   * being switched on, requests notification permission so the browser can
   * surface the nudges.
   */
  function changeReminder(changes: Partial<ReminderSettingsValue>) {
    if (changes.enabled) {
      ensureNotificationPermission().catch(logger.error)
    }
    setReminder((prev) => ({ ...prev, ...changes }))
    savePersistedState({ reminder: reminder() })
  }

  // Wire up the gentle drink-water reminder.
  createReminderEngine({ settings: reminder })

  onMount(() => {
    // Advance the clock every 30s so schedule deadlines update on their own.
    const clockInterval = setInterval(() => setNow(new Date()), 30_000)
    onCleanup(() => clearInterval(clockInterval))
  })

  const value: SettingsContextValue = {
    bottleSize,
    dailyGoal,
    schedule: () => schedule,
    reminder,
    now,
    setBottleSize,
    setDailyGoal,
    updateCheckpoint,
    removeCheckpoint,
    addCheckpoint,
    changeReminder,
  }

  return (
    <SettingsContext.Provider value={value}>
      {props.children}
    </SettingsContext.Provider>
  )
}

/** Accesses the configurable settings context. Throws if used outside its provider. */
export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
