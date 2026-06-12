import { For, Show } from 'solid-js'
import type { LocalWaterLog } from '../db/db'
import { formatTime, formatMl } from '../utils'

interface Props {
  /** Time-descending array of today's individual water log entries. */
  logs: () => LocalWaterLog[]
}

/** Renders the list of today's individual hydration log entries. */
export function TodayLogList(props: Props) {
  return (
    <div class="w-full max-w-105 mt-5">
      <div class="text-[13px] font-semibold text-[#7a7f96] uppercase tracking-[0.5px] mb-2.5 px-0.5">
        Today's Progress
      </div>
      <div class="flex flex-col gap-1.5">
        <Show
          when={props.logs().length > 0}
          fallback={
            <div class="text-[13px] text-[#7a7f96] py-2.5 px-4">
              Nothing logged yet — take your first sip!
            </div>
          }
        >
          <For each={props.logs()}>
            {(log) => (
              <div class="bg-[#1a1d26] border border-white/8 rounded-[10px] py-2.5 px-4 flex items-center justify-between">
                <span class="text-sm font-medium">{formatTime(log.logged_at)}</span>
                <span class="text-[13px] text-sky-400 font-semibold">{formatMl(log.amount_ml)}</span>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  )
}
