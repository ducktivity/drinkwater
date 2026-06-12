import { formatMl } from '../utils'

interface Props {
  totalMl: () => number
  goal: () => number
}

/**
 * Renders a single stat tile with a muted label and a bold value.
 * The optional valueClass overrides the value colour (used to highlight stats).
 */
const renderStatCard = (
  label: string,
  value: () => string,
  valueClass = 'text-[#f0f2f7]',
) => (
  <div class="bg-[#222535] rounded-[10px] py-3 px-2.5 text-center">
    <div class="text-[11px] text-[#7a7f96] uppercase tracking-[0.5px] mb-1">
      {label}
    </div>
    <div class={`text-lg font-semibold ${valueClass}`}>{value()}</div>
  </div>
)

/**
 * Displays today's hydration progress: the amount drunk, how far it is toward
 * the daily goal (as a percentage), and the goal itself.
 */
export function StatsRow(props: Props) {
  /** Percentage of the daily goal reached so far (0 when no goal is set). */
  const goalProgressPercent = () => {
    const goal = props.goal()
    if (goal <= 0) return 0
    return Math.round((props.totalMl() / goal) * 100)
  }

  /** Whether the user has met or exceeded today's goal. */
  const isGoalReached = () => goalProgressPercent() >= 100

  return (
    <div class="w-full grid grid-cols-3 gap-2.5">
      {renderStatCard(
        'Drank today',
        () => formatMl(props.totalMl()),
        'text-sky-400',
      )}
      {renderStatCard(
        'Of goal',
        () => `${goalProgressPercent()}%`,
        isGoalReached() ? 'text-emerald-400' : 'text-[#f0f2f7]',
      )}
      {renderStatCard('Goal', () => formatMl(props.goal()))}
    </div>
  )
}
