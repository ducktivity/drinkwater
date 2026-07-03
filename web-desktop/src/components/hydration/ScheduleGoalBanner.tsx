import { createMemo, Show } from 'solid-js'
import { formatClockTime, formatMl } from '../../utils'
import {
  evaluateSchedule,
  getMostRecentMissed,
  getNextCheckpoint,
} from '../../schedule'
import { useSettings } from '../../context/SettingsContext'
import { useHydration } from '../../context/HydrationContext'
import { useHistory } from '../../context/HistoryContext'

/**
 * Prominent banner that tells the user where they stand against their timed hydration schedule: a strong warning when a deadline has been missed, or the next goal (how much more to drink, and by when) otherwise. Only meaningful on the live day, so it renders nothing while viewing a past day. Pulls the schedule, today's total, and the ticking clock from context.
 */
export function ScheduleGoalBanner() {
  const settings = useSettings()
  const hydration = useHydration()
  const history = useHistory()

  const statuses = createMemo(() =>
    evaluateSchedule(
      settings.schedule(),
      hydration.totalMlConsumedToday(),
      settings.now(),
    ),
  )

  const missed = createMemo(() => getMostRecentMissed(statuses()))
  const nextCheckpoint = createMemo(() => getNextCheckpoint(statuses()))

  // Only applies to the live day, and only when a schedule is configured.
  return (
    <Show when={history.isViewingToday() && settings.schedule().length > 0}>
      <Show
        when={missed()}
        fallback={
          <Show
            when={nextCheckpoint()}
            fallback={
              <div class="w-full rounded-[10px] bg-emerald-500/10 border border-emerald-500/30 py-2.5 px-3.5 text-center text-[13px] font-semibold text-emerald-400">
                🎉 All scheduled goals met — you're ahead of the clock!
              </div>
            }
          >
            {(next) => (
              <div class="w-full rounded-[10px] bg-sky-500/10 border border-sky-500/30 py-2.5 px-3.5 text-center">
                <div class="text-[11px] text-[#7a7f96] uppercase tracking-[0.5px] mb-0.5">
                  Next goal
                </div>
                <div class="text-sm font-semibold text-sky-400">
                  Drink {formatMl(next().remainingMl)} more by{' '}
                  {formatClockTime(next().time)}
                </div>
              </div>
            )}
          </Show>
        }
      >
        {(behind) => (
          <div class="w-full rounded-[10px] bg-red-500/15 border border-red-500/40 py-2.5 px-3.5 text-center">
            <div class="text-[11px] text-red-300 uppercase tracking-[0.5px] mb-0.5">
              ⚠️ Behind schedule
            </div>
            <div class="text-sm font-semibold text-red-400">
              You should have drunk {formatMl(behind().targetMl)} by{' '}
              {formatClockTime(behind().time)} —{' '}
              {formatMl(behind().remainingMl)} short!
            </div>
          </div>
        )}
      </Show>
    </Show>
  )
}
