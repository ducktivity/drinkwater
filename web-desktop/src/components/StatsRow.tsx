import { formatMl } from '../utils'

interface Props {
  totalMl: () => number
  completedBottleCount: () => number
  /** Current fill fraction of the active bottle (0 = empty, 1 = full). */
  fillFraction: () => number
  goal: () => number
}

/**
 * Renders a single stat tile with a muted label and a bold value.
 * Pass highlight=true to render the value in sky-blue (used for the primary stat).
 */
const renderStatCard = (label: string, value: () => string, highlight = false) => (
  <div class="bg-[#222535] rounded-[10px] py-3 px-2.5 text-center">
    <div class="text-[11px] text-[#7a7f96] uppercase tracking-[0.5px] mb-1">
      {label}
    </div>
    <div
      class={`text-lg font-semibold ${highlight ? 'text-sky-400' : 'text-[#f0f2f7]'}`}
    >
      {value()}
    </div>
  </div>
)

/** Displays the three summary tiles: total consumed, bottle count, and daily goal. */
export function StatsRow(props: Props) {
  return (
    <div class="w-full grid grid-cols-3 gap-2.5">
      {renderStatCard('Drank today', () => formatMl(props.totalMl()), true)}
      {renderStatCard(
        'Bottles',
        // Append '+' when a bottle is partially consumed to indicate an in-progress bottle
        () => `${props.completedBottleCount()}${props.fillFraction() < 1 ? '+' : ''}`,
      )}
      {renderStatCard('Goal', () => formatMl(props.goal()))}
    </div>
  )
}
