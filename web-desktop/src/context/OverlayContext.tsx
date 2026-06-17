import {
  createContext,
  createSignal,
  useContext,
  type Accessor,
  type ParentProps,
} from 'solid-js'
import { db, type LocalWaterLog } from '../db/db'
import { syncEngine } from '../db/sync'
import { logger } from '../logger'
import { savePersistedState } from '../state/persistence'
import { useSettings } from './SettingsContext'
import { useHydration } from './HydrationContext'

/**
 * UI overlay state: the slide-over settings drawer and the four dialogs'
 * visibility (and the entity each acts on). Each dialog owns its own
 * save/confirm logic; the context only holds the shared state and the
 * bottle-flow handlers that open/resolve the confirm dialog.
 */
interface OverlayContextValue {
  /** Whether the slide-over settings drawer is open. */
  isSettingsOpen: Accessor<boolean>
  /** Opens the settings drawer (preferences, schedule, reminders, account). */
  openSettings: () => void
  /** Closes the settings drawer. */
  closeSettings: () => void
  /** Whether the confirm-drink dialog is open. */
  isConfirmVisible: Accessor<boolean>
  /** Millilitres the confirm dialog will commit when accepted. */
  pendingLogMl: Accessor<number>
  /** The log entry pending deletion (null when no delete is in progress). */
  logPendingDeletion: Accessor<LocalWaterLog | null>
  setLogPendingDeletion: (log: LocalWaterLog | null) => void
  /** The log entry currently being edited (null when no edit is in progress). */
  logBeingEdited: Accessor<LocalWaterLog | null>
  setLogBeingEdited: (log: LocalWaterLog | null) => void
  /** Whether the "add a past log" dialog is open. */
  isAddingLog: Accessor<boolean>
  setIsAddingLog: (open: boolean) => void
  /** Called when the user drags the bottle to empty — triggers the confirm dialog. */
  handleBottleEmptied: () => void
  /** Called when the user taps "Log drank" — confirms the amount drunk so far. */
  handleLogDrank: () => void
  /** Commits the pending amount to IndexedDB and kicks off a background sync. */
  handleLogConfirm: () => Promise<void>
  /** Dismisses the confirm dialog and restores the bottle to its prior level. */
  handleLogCancel: () => void
}

const OverlayContext = createContext<OverlayContextValue>()

/** Provides the dialog overlay state and the handlers that mutate log data. */
export function OverlayProvider(props: ParentProps) {
  const settings = useSettings()
  const hydration = useHydration()

  // Whether the slide-over settings drawer is open.
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false)

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
  // Whether the "add a past log" dialog is open.
  const [isAddingLog, setIsAddingLog] = createSignal(false)

  /** Called when the user drags the bottle to empty — triggers the confirm dialog. */
  function handleBottleEmptied() {
    hydration.setFillFraction(0)
    hydration.setSettledFillFraction(0)
    // The whole bottle was emptied, so the pending log is the full bottle size.
    setPendingLogMl(settings.bottleSize())
    // If cancelled, restore a near-empty bottle so the user can retry the drag.
    setFillToRestoreOnCancel(0.05)
    savePersistedState({ fillFraction: 0 })
    setIsConfirmVisible(true)
  }

  /**
   * Called when the user taps "Log drank": logs the amount consumed from the
   * active bottle so far (without requiring a drag to empty) via the confirm
   * dialog. The bottle level is left untouched until the log is confirmed.
   */
  function handleLogDrank() {
    const drankMl = Math.round(
      (1 - hydration.fillFraction()) * settings.bottleSize(),
    )
    if (drankMl <= 0) return
    setPendingLogMl(drankMl)
    // If cancelled, restore the level the bottle was at before opening the dialog.
    setFillToRestoreOnCancel(hydration.fillFraction())
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
    hydration.setFillFraction(1)
    // The drunk amount is now recorded as a log and the bottle is full again, so
    // the active bottle no longer contributes to the active-bottle portion of the
    // daily total (it counts via the log above).
    hydration.setSettledFillFraction(1)
    setIsConfirmVisible(false)
    savePersistedState({ fillFraction: 1 })
    syncEngine().catch(logger.error)
  }

  /** Dismisses the confirm dialog and restores the bottle to the level captured when it opened. */
  function handleLogCancel() {
    hydration.setFillFraction(fillToRestoreOnCancel())
    hydration.setSettledFillFraction(fillToRestoreOnCancel())
    setIsConfirmVisible(false)
    savePersistedState({ fillFraction: fillToRestoreOnCancel() })
  }

  const value: OverlayContextValue = {
    isSettingsOpen,
    openSettings: () => setIsSettingsOpen(true),
    closeSettings: () => setIsSettingsOpen(false),
    isConfirmVisible,
    pendingLogMl,
    logPendingDeletion,
    setLogPendingDeletion,
    logBeingEdited,
    setLogBeingEdited,
    isAddingLog,
    setIsAddingLog,
    handleBottleEmptied,
    handleLogDrank,
    handleLogConfirm,
    handleLogCancel,
  }

  return (
    <OverlayContext.Provider value={value}>
      {props.children}
    </OverlayContext.Provider>
  )
}

/** Accesses the overlay/dialog context. Throws if used outside its provider. */
export function useOverlay() {
  const context = useContext(OverlayContext)
  if (!context) {
    throw new Error('useOverlay must be used within an OverlayProvider')
  }
  return context
}
