import { StatsRow } from '../hydration/StatsRow'
import { BottleSection } from '../hydration/BottleSection'
import { ScheduleGoalBanner } from '../hydration/ScheduleGoalBanner'
import { DateNavigator } from '../hydration/DateNavigator'
import { LogList } from '../hydration/LogList'
import { Navbar } from './Navbar'
import { SettingsDrawer } from '../settings/SettingsDrawer'

/**
 * The app shell: a top navbar (brand + sync + settings), the focused hydration card (date, stats, goal banner, bottle), the history log list, and the slide-over settings drawer. Every section pulls its own state from context, so the shell only arranges them — it threads no props through.
 */
export function AppLayout() {
  return (
    <div class="min-h-screen bg-[#0f1117] text-[#f0f2f7] font-sans">
      <Navbar />

      <div class="flex flex-col items-center px-4 pt-6 pb-10">
        {/* Main UI card: the focused hydration interaction. */}
        <div class="w-full max-w-105 bg-[#1a1d26] border border-white/8 rounded-2xl pt-7 px-6 pb-6 flex flex-col items-center gap-6">
          <DateNavigator />

          <div class="w-full h-px bg-white/8" />

          <StatsRow />

          {/* The banner gates itself to the live day. */}
          <ScheduleGoalBanner />

          <BottleSection />
        </div>

        <LogList />
      </div>

      <SettingsDrawer />
    </div>
  )
}
