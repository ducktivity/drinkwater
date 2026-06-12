import { For, Show } from 'solid-js'
import { formatDay, formatMl } from '../utils'

interface Props {
  /** Date-descending array of [YYYY-MM-DD, totalMl] pairs for past days. */
  history: () => [string, number][]
}

/** Renders the scrollable list of daily hydration totals for the past 14 days. */
export function HistoryList(props: Props) {
  return (
    <div class="w-full max-w-105 mt-5">
      <div class="text-[13px] font-semibold text-[#7a7f96] uppercase tracking-[0.5px] mb-2.5 px-0.5">
        History
      </div>
      <div class="flex flex-col gap-1.5">
        <Show
          when={props.history().length > 0}
          fallback={
            <div class="text-[13px] text-[#7a7f96] py-2.5 px-4">
              No history yet — start drinking!
            </div>
          }
        >
          <For each={props.history()}>
            {([dateKey, totalMl]) => (
              <div class="bg-[#1a1d26] border border-white/8 rounded-[10px] py-2.5 px-4 flex items-center justify-between">
                <span class="text-sm font-medium">{formatDay(dateKey)}</span>
                <span class="text-[13px] text-sky-400 font-semibold">{formatMl(totalMl)}</span>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  )
}
