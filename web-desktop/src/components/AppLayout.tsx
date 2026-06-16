import { Show } from 'solid-js'
import { formatFullDay } from '../utils'
import { useSettings } from '../context/SettingsContext'
import { useHydration } from '../context/HydrationContext'
import { useHistory } from '../context/HistoryContext'
import { useOverlay } from '../context/OverlayContext'
import { StatsRow } from './StatsRow'
import { SyncButton } from './SyncButton'
import { BottleSection } from './BottleSection'
import { syncEngine } from '../db/sync'
import { SettingsSection } from './SettingsSection'
import { ScheduleGoalBanner } from './ScheduleGoalBanner'
import { ScheduleSettings } from './ScheduleSettings'
import { DateNavigator } from './DateNavigator'
import { LogList } from './LogList'
import { ReminderSettings } from './ReminderSettings'

/**
 * The main hydration card and log list. Pulls all state and actions from the
 * settings/hydration/history/overlay contexts; the dialogs live in AppDialogs.
 */
export function AppLayout() {
  const settings = useSettings()
  const hydration = useHydration()
  const history = useHistory()
  const overlay = useOverlay()

  return (
    <div class="min-h-screen bg-[#0f1117] text-[#f0f2f7] font-sans flex flex-col items-center px-4 pt-6 pb-10">
      <div class="relative w-full max-w-105 bg-[#1a1d26] border border-white/8 rounded-2xl pt-7 px-6 pb-6 flex flex-col items-center gap-6">
        {/* Manual sync control, anchored to the card's top-right corner. */}
        <div class="absolute top-2.5 right-2.5">
          <SyncButton onSync={syncEngine} />
        </div>

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

        <div class="w-full h-px bg-white/8" />

        <SettingsSection
          size={settings.bottleSize}
          goal={settings.dailyGoal}
          onSizeChange={settings.setBottleSize}
          onGoalChange={settings.setDailyGoal}
        />

        {/* Schedule and reminder settings are irrelevant when reviewing a past day, so they're hidden unless today is selected. */}
        <Show when={history.isViewingToday()}>
          <div class="w-full h-px bg-white/8" />

          <ScheduleSettings
            schedule={settings.schedule}
            totalMl={hydration.totalMlConsumedToday}
            now={settings.now}
            onUpdateCheckpoint={settings.updateCheckpoint}
            onRemoveCheckpoint={settings.removeCheckpoint}
            onAddCheckpoint={settings.addCheckpoint}
          />

          <div class="w-full h-px bg-white/8" />

          <ReminderSettings
            settings={settings.reminder}
            onChange={settings.changeReminder}
          />
        </Show>
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
  )
}
