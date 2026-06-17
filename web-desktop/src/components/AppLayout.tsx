import { Show, createSignal } from 'solid-js'
import { formatFullDay } from '../utils'
import { useSettings } from '../context/SettingsContext'
import { useHydration } from '../context/HydrationContext'
import { useHistory } from '../context/HistoryContext'
import { useOverlay } from '../context/OverlayContext'
import { useToast } from '../context/ToastContext'
import { StatsRow } from './StatsRow'
import { BottleSection } from './BottleSection'
import { syncEngine } from '../db/sync'
import { ScheduleGoalBanner } from './ScheduleGoalBanner'
import { DateNavigator } from './DateNavigator'
import { LogList } from './LogList'
import { Navbar } from './Navbar'
import { SettingsDrawer } from './SettingsDrawer'

/**
 * The app shell: a top navbar (brand + sync + settings), the focused hydration
 * card (date, stats, goal banner, bottle), the history log list, and the
 * slide-over settings drawer. Configuration lives entirely in the drawer so the
 * main card stays centred on the core drink-logging interaction.
 */
export function AppLayout() {
  const settings = useSettings()
  const hydration = useHydration()
  const history = useHistory()
  const overlay = useOverlay()
  const toast = useToast()

  // Whether the slide-over settings drawer is open.
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false)

  /**
   * Runs a manual sync and surfaces a toast if it fails, distinguishing being
   * offline (changes are queued locally) from an actual backend error. Returns
   * the outcome so the SyncButton can render its spin/synced feedback.
   */
  async function handleManualSync() {
    const succeeded = await syncEngine()
    if (!succeeded) {
      if (!navigator.onLine) {
        toast.showToast(
          "You're offline — your changes will sync once you're back online.",
          'info',
        )
      } else {
        toast.showToast('Sync failed. Please try again.', 'error')
      }
    }
    return succeeded
  }

  return (
    <div class="min-h-screen bg-[#0f1117] text-[#f0f2f7] font-sans">
      <Navbar
        onSync={handleManualSync}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <div class="flex flex-col items-center px-4 pt-6 pb-10">
        {/* Main UI card: the focused hydration interaction. */}
        <div class="w-full max-w-105 bg-[#1a1d26] border border-white/8 rounded-2xl pt-7 px-6 pb-6 flex flex-col items-center gap-6">
          <DateNavigator
            selectedDate={history.selectedDate}
            onSelect={history.setSelectedDate}
          />

          <div class="w-full h-px bg-white/8" />

          <StatsRow
            totalMl={history.selectedDayTotalMl}
            goal={settings.dailyGoal}
          />

          {/* The next-goal banner only applies to the live day. */}
          <Show when={history.isViewingToday()}>
            <ScheduleGoalBanner
              schedule={settings.schedule}
              totalMl={hydration.totalMlConsumedToday}
              now={settings.now}
            />
          </Show>

          {/* On a past day the bottle is a static, full visual (non-interactive),
                since dragging it would log against today, not the day being viewed. */}
          <BottleSection
            size={settings.bottleSize}
            fillFraction={() =>
              history.isViewingToday() ? hydration.fillFraction() : 1
            }
            interactive={history.isViewingToday}
            onFillFractionChange={hydration.handleFillFractionChange}
            onBottleEmptied={overlay.handleBottleEmptied}
            onDragSettled={hydration.handleDragSettled}
            onLogDrank={overlay.handleLogDrank}
          />
        </div>

        <LogList
          title={
            history.isViewingToday()
              ? "Today's Progress"
              : formatFullDay(history.selectedDate())
          }
          logs={history.displayedLogs}
          onEdit={overlay.setLogBeingEdited}
          onDelete={overlay.setLogPendingDeletion}
          onAdd={
            history.isViewingToday()
              ? undefined
              : () => overlay.setIsAddingLog(true)
          }
          isLoading={history.isLoadingHistory}
        />
      </div>

      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  )
}
