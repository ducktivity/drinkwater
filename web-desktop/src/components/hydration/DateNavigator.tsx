import { Show } from 'solid-js'
import { getTodayKey, shiftDateKey, formatFullDay } from '../../utils'
import { useHistory } from '../../context/HistoryContext'

/**
 * Day picker for the hydration history view. Lets the user step back/forward a day with the arrows or jump to any past date with the native date input. Forward navigation is capped at today since future days have no logs. Reads and drives the selected day through the history context.
 */
export function DateNavigator() {
  const history = useHistory()
  const isToday = () => history.selectedDate() === getTodayKey()

  /** Steps the selected day by the given delta, never past today. */
  function step(dayDelta: number) {
    const next = shiftDateKey(history.selectedDate(), dayDelta)
    if (next > getTodayKey()) return
    history.setSelectedDate(next)
  }

  return (
    <div class="flex items-center justify-between gap-3 w-full">
      <button
        type="button"
        aria-label="Previous day"
        class="text-[#7a7f96] hover:text-sky-400 cursor-pointer p-1 leading-none transition-colors"
        onClick={() => step(-1)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <div class="text-sm font-semibold text-[#f0f2f7]">
        <Show when={!isToday()} fallback="Today">
          {formatFullDay(history.selectedDate())}
        </Show>
      </div>

      <button
        type="button"
        aria-label="Next day"
        disabled={isToday()}
        class="text-[#7a7f96] hover:text-sky-400 cursor-pointer p-1 leading-none transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-[#7a7f96]"
        onClick={() => step(1)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  )
}
