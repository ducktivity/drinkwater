import {
  createSignal,
  createMemo,
  createEffect,
  onMount,
  onCleanup,
  Show,
} from 'solid-js'
import { createStore } from 'solid-js/store'
import { liveQuery } from 'dexie'
import { db, type LocalWaterLog } from './db/db'
import { syncEngine } from './db/sync'
import { cleanupSyncedStaleLogs } from './db/cleanup'
import { fetchLogsForDate } from './db/history'
import {
  getTodayKey,
  toTimeInputValue,
  formatFullDay,
  compareLoggedAtDesc,
} from './utils'
import { StatsRow } from './components/StatsRow'
import { BottleSection } from './components/BottleSection'
import { SettingsSection } from './components/SettingsSection'
import { ScheduleGoalBanner } from './components/ScheduleGoalBanner'
import { ScheduleSettings } from './components/ScheduleSettings'
import { DateNavigator } from './components/DateNavigator'
import { LogList } from './components/LogList'
import { ReminderSettings } from './components/ReminderSettings'
import { DEFAULT_SCHEDULE, type ScheduleCheckpoint } from './schedule'
import {
  DEFAULT_REMINDER_SETTINGS,
  createReminderEngine,
  ensureNotificationPermission,
  type ReminderSettings as ReminderSettingsValue,
} from './reminder'
import { ConfirmLogDialog } from './components/dialogs/ConfirmLogDialog'
import { DeleteLogDialog } from './components/dialogs/DeleteLogDialog'
import { EditLogDialog } from './components/dialogs/EditLogDialog'
import { AddLogDialog } from './components/dialogs/AddLogDialog'

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
function loadPersistedState(): HydrationUIState {
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

export default function App() {
  const initialState = loadPersistedState()

  // User-configurable settings
  const [bottleSize, setBottleSize] = createSignal(initialState.size)
  const [dailyGoal, setDailyGoal] = createSignal(initialState.goal)
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

  // UI overlay state
  const [isConfirmVisible, setIsConfirmVisible] = createSignal(false)
  // Millilitres the confirm dialog will commit when accepted. This is the full
  // bottle size when emptying via drag, or the partially-drunk amount when the
  // user taps "Log drank".
  const [pendingLogMl, setPendingLogMl] = createSignal(0)
  // The fill fraction to restore if the user cancels the confirm dialog. Lets the
  // drag-to-empty and "log drank" flows each return the bottle to a sensible level.
  const [fillToRestoreOnCancel, setFillToRestoreOnCancel] = createSignal(0.05)
  // The log entry pending deletion (null when no delete is in progress)
  const [logPendingDeletion, setLogPendingDeletion] =
    createSignal<LocalWaterLog | null>(null)
  // The log entry currently being edited (null when no edit is in progress)
  const [logBeingEdited, setLogBeingEdited] =
    createSignal<LocalWaterLog | null>(null)

  // Live water logs from the local IndexedDB database
  const [waterLogs, setWaterLogs] = createSignal<LocalWaterLog[]>([])

  // History view state ─────────────────────────────────────────────────────
  // The day currently being viewed, as a YYYY-MM-DD key. Defaults to today.
  const [selectedDate, setSelectedDate] = createSignal(getTodayKey())
  // Logs fetched for a past day (today's logs come from the live query instead).
  const [historyLogs, setHistoryLogs] = createSignal<LocalWaterLog[]>([])
  // Whether a past day's logs are currently being fetched from the backend.
  const [isLoadingHistory, setIsLoadingHistory] = createSignal(false)
  // Whether the "add a past log" dialog is open.
  const [isAddingLog, setIsAddingLog] = createSignal(false)

  /** Whether the user is viewing today (vs. a historical day). */
  const isViewingToday = () => selectedDate() === getTodayKey()

  /** Persists the current UI state snapshot to localStorage. */
  function persistState() {
    localStorage.setItem(
      HYDRATION_STORAGE_KEY,
      JSON.stringify({
        size: bottleSize(),
        goal: dailyGoal(),
        fillFraction: fillFraction(),
        schedule: schedule,
        reminder: reminder(),
        date: getTodayKey(),
      }),
    )
  }

  /**
   * Today's individual water log entries, most recent first.
   */
  const todayLogs = createMemo(() => {
    const today = getTodayKey()
    return waterLogs()
      .filter((log) => log.logged_at.substring(0, 10) === today)
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
      (1 - settledFillFraction()) * bottleSize(),
    )
    return loggedTotal + activeBottleConsumed
  })

  /** The log entries shown in the list: today's live logs, or a fetched past day. */
  const displayedLogs = createMemo(() =>
    isViewingToday() ? todayLogs() : historyLogs(),
  )

  /**
   * Total millilitres for the selected day. Today reuses the live total (which
   * folds in the active bottle); past days sum their fetched logs.
   */
  const selectedDayTotalMl = createMemo(() =>
    isViewingToday()
      ? totalMlConsumedToday()
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
        if (selectedDate() === date) setHistoryLogs([])
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

  // Wire up the gentle drink-water reminder.
  createReminderEngine({ settings: reminder })

  /**
   * Applies a partial change to the reminder settings. When the reminder is
   * being switched on, requests notification permission so the browser can
   * surface the nudges.
   */
  function handleReminderChange(changes: Partial<ReminderSettingsValue>) {
    if (changes.enabled) {
      ensureNotificationPermission().catch(console.error)
    }
    setReminder((prev) => ({ ...prev, ...changes }))
    persistState()
  }

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
    persistState()
  }

  /** Called when the user drags the bottle to empty — triggers the confirm dialog. */
  function handleBottleEmptied() {
    setFillFraction(0)
    setSettledFillFraction(0)
    // The whole bottle was emptied, so the pending log is the full bottle size.
    setPendingLogMl(bottleSize())
    // If cancelled, restore a near-empty bottle so the user can retry the drag.
    setFillToRestoreOnCancel(0.05)
    persistState()
    setIsConfirmVisible(true)
  }

  /**
   * Called when the user taps "Log drank": logs the amount consumed from the
   * active bottle so far (without requiring a drag to empty) via the confirm
   * dialog. The bottle level is left untouched until the log is confirmed.
   */
  function handleLogDrank() {
    const drankMl = Math.round((1 - fillFraction()) * bottleSize())
    if (drankMl <= 0) return
    setPendingLogMl(drankMl)
    // If cancelled, restore the level the bottle was at before opening the dialog.
    setFillToRestoreOnCancel(fillFraction())
    setIsConfirmVisible(true)
  }

  /** Commits the pending amount to IndexedDB and kicks off a background sync. */
  async function handleLogConfirm() {
    await db.waterLogs.add({
      id: crypto.randomUUID(),
      amount_ml: pendingLogMl(),
      logged_at: new Date().toISOString(),
      is_deleted: false,
      is_synced: 0,
    })
    setFillFraction(1)
    // The drunk amount is now recorded as a log and the bottle is full again, so
    // the active bottle no longer contributes to the active-bottle portion of the
    // daily total (it counts via the log above).
    setSettledFillFraction(1)
    setIsConfirmVisible(false)
    persistState()
    syncEngine().catch(console.error)
  }

  /**
   * Soft-deletes the pending log entry: flags it as deleted and unsynced in
   * IndexedDB, then kicks off a background sync to propagate to the backend.
   */
  async function handleDeleteConfirm() {
    const log = logPendingDeletion()
    if (!log) return
    // Upsert the full record (rather than update by id): a historical log fetched
    // from the backend may not exist in IndexedDB yet, so we must write it in full
    // — flagged deleted and unsynced — for the soft-delete to propagate on sync.
    const deleted: LocalWaterLog = { ...log, is_deleted: true, is_synced: 0 }
    await db.waterLogs.put(deleted)
    syncHistoryView(deleted)
    setLogPendingDeletion(null)
    syncEngine().catch(console.error)
  }

  /**
   * Persists edits to a log entry: updates the amount and timestamp, flags it
   * as unsynced in IndexedDB, then kicks off a background sync to the backend.
   */
  async function handleEditSave(changes: {
    amount_ml: number
    logged_at: string
  }) {
    const log = logBeingEdited()
    if (!log) return

    // Nothing changed — close the dialog without touching the sync state.
    // Timestamps are compared at local minute granularity (matching the time
    // input's precision) so equivalent instants in different ISO formats
    // (e.g. "...Z" vs "...+08:00") don't register as a spurious change.
    const isUnchanged =
      changes.amount_ml === log.amount_ml &&
      toTimeInputValue(changes.logged_at) === toTimeInputValue(log.logged_at)
    if (isUnchanged) {
      setLogBeingEdited(null)
      return
    }

    // Upsert the full record: a historical log fetched from the backend may not
    // be present in IndexedDB, so writing it in full (rather than update-by-id)
    // ensures the edit is persisted and queued for sync in both cases.
    const updated: LocalWaterLog = { ...log, ...changes, is_synced: 0 }
    await db.waterLogs.put(updated)
    syncHistoryView(updated)
    setLogBeingEdited(null)
    syncEngine().catch(console.error)
  }

  /**
   * Adds a back-filled log to the selected (past) day: writes a new unsynced
   * entry to IndexedDB, reflects it in the history list, and kicks off a sync.
   */
  async function handleAddLogSave(changes: {
    amount_ml: number
    logged_at: string
  }) {
    const newLog: LocalWaterLog = {
      id: crypto.randomUUID(),
      amount_ml: changes.amount_ml,
      logged_at: changes.logged_at,
      is_deleted: false,
      is_synced: 0,
    }
    await db.waterLogs.add(newLog)
    syncHistoryView(newLog)
    setIsAddingLog(false)
    syncEngine().catch(console.error)
  }

  /**
   * Updates a single field of one checkpoint in place. Using the store's
   * path syntax (predicate + key + value) means only the targeted field
   * changes, so the checkpoint's object identity — and the editor row bound to
   * it — survives the edit instead of being recreated.
   */
  function handleCheckpointUpdate(
    id: string,
    changes: Partial<ScheduleCheckpoint>,
  ) {
    for (const [key, value] of Object.entries(changes)) {
      setSchedule(
        (checkpoint) => checkpoint.id === id,
        key as keyof ScheduleCheckpoint,
        value as never,
      )
    }
    persistState()
  }

  /** Removes a checkpoint from the schedule. */
  function handleCheckpointRemove(id: string) {
    setSchedule((prev) => prev.filter((checkpoint) => checkpoint.id !== id))
    persistState()
  }

  /** Appends a new midday checkpoint the user can then adjust. */
  function handleCheckpointAdd() {
    setSchedule((prev) => [
      ...prev,
      { id: crypto.randomUUID(), time: '12:00', targetMl: 1000 },
    ])
    persistState()
  }

  /** Dismisses the confirm dialog and restores the bottle to the level captured when it opened. */
  function handleLogCancel() {
    setFillFraction(fillToRestoreOnCancel())
    setSettledFillFraction(fillToRestoreOnCancel())
    setIsConfirmVisible(false)
    persistState()
  }

  onMount(() => {
    // Subscribe to live changes in the local water log table
    const liveQuerySubscription = liveQuery(() =>
      db.waterLogs.filter((log) => !log.is_deleted).sortBy('logged_at'),
    ).subscribe({ next: setWaterLogs, error: console.error })

    // Prune stale (non-today) synced logs that the UI never renders. Runs even
    // when offline, where the sync below would bail before its own cleanup step.
    cleanupSyncedStaleLogs().catch(console.error)

    // Attempt an initial sync on app load
    syncEngine().catch(console.error)

    // Re-sync whenever the device regains network connectivity
    const handleOnline = () => syncEngine().catch(console.error)
    window.addEventListener('online', handleOnline)

    // Advance the clock every 30s so schedule deadlines update on their own.
    const clockInterval = setInterval(() => setNow(new Date()), 30_000)

    onCleanup(() => {
      liveQuerySubscription.unsubscribe()
      window.removeEventListener('online', handleOnline)
      clearInterval(clockInterval)
    })
  })

  return (
    <div class="min-h-screen bg-[#0f1117] text-[#f0f2f7] font-sans flex flex-col items-center px-4 pt-6 pb-10">
      <div class="w-full max-w-105 bg-[#1a1d26] border border-white/8 rounded-2xl pt-7 px-6 pb-6 flex flex-col items-center gap-6">
        <DateNavigator selectedDate={selectedDate} onSelect={setSelectedDate} />

        <div class="w-full h-px bg-white/8" />

        <StatsRow totalMl={selectedDayTotalMl} goal={dailyGoal} />

        {/* The next-goal banner only applies to the live day. */}
        <Show when={isViewingToday()}>
          <ScheduleGoalBanner
            schedule={() => schedule}
            totalMl={totalMlConsumedToday}
            now={now}
          />
        </Show>

        {/* On a past day the bottle is a static, full visual (non-interactive),
            since dragging it would log against today, not the day being viewed. */}
        <BottleSection
          size={bottleSize}
          fillFraction={() => (isViewingToday() ? fillFraction() : 1)}
          interactive={isViewingToday}
          onFillFractionChange={handleFillFractionChange}
          onBottleEmptied={handleBottleEmptied}
          onDragSettled={handleDragSettled}
          onLogDrank={handleLogDrank}
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

        {/* Schedule and reminder settings are irrelevant when reviewing a past
            day, so they're hidden unless today is selected. */}
        <Show when={isViewingToday()}>
          <div class="w-full h-px bg-white/8" />

          <ScheduleSettings
            schedule={() => schedule}
            totalMl={totalMlConsumedToday}
            now={now}
            onUpdateCheckpoint={handleCheckpointUpdate}
            onRemoveCheckpoint={handleCheckpointRemove}
            onAddCheckpoint={handleCheckpointAdd}
          />

          <div class="w-full h-px bg-white/8" />

          <ReminderSettings
            settings={reminder}
            onChange={handleReminderChange}
          />
        </Show>
      </div>

      <LogList
        title={
          isViewingToday() ? "Today's Progress" : formatFullDay(selectedDate())
        }
        logs={displayedLogs}
        onEdit={setLogBeingEdited}
        onDelete={setLogPendingDeletion}
        onAdd={isViewingToday() ? undefined : () => setIsAddingLog(true)}
        isLoading={isLoadingHistory}
      />

      <Show when={isConfirmVisible()}>
        <ConfirmLogDialog
          amountMl={pendingLogMl}
          onConfirm={handleLogConfirm}
          onCancel={handleLogCancel}
        />
      </Show>

      <Show when={logBeingEdited()}>
        {(log) => (
          <EditLogDialog
            log={log()}
            onSave={handleEditSave}
            onCancel={() => setLogBeingEdited(null)}
          />
        )}
      </Show>

      <Show when={logPendingDeletion()}>
        {(log) => (
          <DeleteLogDialog
            log={log()}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setLogPendingDeletion(null)}
          />
        )}
      </Show>

      <Show when={isAddingLog()}>
        <AddLogDialog
          dateKey={selectedDate()}
          onSave={handleAddLogSave}
          onCancel={() => setIsAddingLog(false)}
        />
      </Show>
    </div>
  )
}
