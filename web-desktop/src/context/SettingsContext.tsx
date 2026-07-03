import {
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type Accessor,
  type ParentProps,
} from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { type ScheduleCheckpoint } from '../schedule'
import {
  ensureNotificationPermission,
  type ReminderSettings as ReminderSettingsValue,
} from '../reminder'
import { loadPersistedState, savePersistedState } from '../state/persistence'
import {
  fetchSettings,
  pushSettings,
  type SyncableSettings,
} from '../db/settings'
import { useAuth } from './AuthContext'
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
  // Timed hydration schedule (deadlines + cumulative targets). Held in a store (not a signal) so edits mutate a single checkpoint field in place. This keeps each checkpoint's object reference stable, so the editor's <For> rows are reused rather than recreated on every keystroke — which is what keeps the time/amount inputs from losing focus mid-edit.
  const [schedule, setSchedule] = createStore<ScheduleCheckpoint[]>(
    initialState.schedule,
  )
  // Drink-water reminder settings (gentle cadence + force escalation).
  const [reminder, setReminder] = createSignal(initialState.reminder)

  // Ticking clock that drives schedule status (next goal / behind warnings). Updated periodically so deadlines flip from "upcoming" to "missed" without requiring user interaction.
  const [now, setNow] = createSignal(new Date())

  const auth = useAuth()

  /** Snapshots the account-bound settings (the subset synced to the backend). */
  function buildSyncableSettings(): SyncableSettings {
    return {
      size: bottleSize(),
      goal: dailyGoal(),
      schedule,
      reminder: reminder(),
    }
  }

  // Debounce backend pushes so a burst of edits (e.g. dragging a checkpoint or rapid goal taps) collapses into a single best-effort write. Cleared on unmount so a pending push never fires after teardown.
  let pushTimer: ReturnType<typeof setTimeout> | undefined
  function schedulePush() {
    if (!auth.isLoggedIn()) return
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(() => {
      pushSettings(buildSyncableSettings()).catch(logger.error)
    }, 500)
  }
  onCleanup(() => {
    if (pushTimer) clearTimeout(pushTimer)
  })

  /**
   * Applies settings fetched from the server into local state. Writes the underlying signal/store setters directly (not the public mutators) and persists them, deliberately skipping {@link schedulePush} so loading from the server does not echo straight back as a write.
   */
  function applyServerSettings(serverSettings: SyncableSettings) {
    setBottleSizeSignal(serverSettings.size)
    setDailyGoalSignal(serverSettings.goal)
    // reconcile replaces the whole schedule store with the server snapshot — including dropping any extra trailing checkpoints — while keeping object identity for checkpoints whose id is unchanged (a plain-array assignment would merge by index and leave a stale tail).
    setSchedule(reconcile(serverSettings.schedule))
    setReminder(serverSettings.reminder)
    savePersistedState({
      size: serverSettings.size,
      goal: serverSettings.goal,
      schedule: serverSettings.schedule,
      reminder: serverSettings.reminder,
    })
  }

  function setBottleSize(newSize: number) {
    setBottleSizeSignal(newSize)
    savePersistedState({ size: newSize })
    schedulePush()
  }

  function setDailyGoal(newGoal: number) {
    setDailyGoalSignal(newGoal)
    savePersistedState({ goal: newGoal })
    schedulePush()
  }

  /**
   * Updates a single field of one checkpoint in place. Using the store's path syntax (predicate + key + value) means only the targeted field changes, so the checkpoint's object identity — and the editor row bound to it — survives the edit instead of being recreated.
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
    schedulePush()
  }

  /** Removes a checkpoint from the schedule. */
  function removeCheckpoint(id: string) {
    setSchedule((prev) => prev.filter((checkpoint) => checkpoint.id !== id))
    savePersistedState({ schedule })
    schedulePush()
  }

  /** Appends a new midday checkpoint the user can then adjust. */
  function addCheckpoint() {
    setSchedule((prev) => [
      ...prev,
      { id: crypto.randomUUID(), time: '12:00', targetMl: 1000 },
    ])
    savePersistedState({ schedule })
    schedulePush()
  }

  /**
   * Applies a partial change to the reminder settings. When the reminder is being switched on, requests notification permission so the browser can surface the nudges.
   */
  function changeReminder(changes: Partial<ReminderSettingsValue>) {
    if (changes.enabled) {
      ensureNotificationPermission().catch(logger.error)
    }
    setReminder((prev) => ({ ...prev, ...changes }))
    savePersistedState({ reminder: reminder() })
    schedulePush()
  }

  // Load the account's saved settings once per sign-in (server wins). When the account has no settings yet (a definitive 404 → null), seed it from the current local settings so this device's configuration becomes the account default. A non-definitive failure (offline, 5xx, …) rejects and is logged, leaving local state untouched and un-seeded. Runs for both fresh logins and restored sessions, since both flip auth.user() from null to a value.
  let settingsLoaded = false
  createEffect(() => {
    const currentUser = auth.user()
    if (!currentUser) {
      // Signed out: re-arm so the next sign-in reloads from the server.
      settingsLoaded = false
      return
    }
    if (settingsLoaded) return
    settingsLoaded = true
    fetchSettings()
      .then((serverSettings) => {
        if (serverSettings) {
          applyServerSettings(serverSettings)
        } else {
          // No settings on the account yet: seed from local.
          pushSettings(buildSyncableSettings()).catch(logger.error)
        }
      })
      .catch(logger.error)
  })

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
