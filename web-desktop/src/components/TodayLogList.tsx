import { For, Show } from 'solid-js'
import type { LocalWaterLog } from '../db/db'
import { formatTime, formatMl } from '../utils'

interface Props {
  /** Time-descending array of today's individual water log entries. */
  logs: () => LocalWaterLog[]
  /** Called when the user requests to edit a specific log entry. */
  onEdit: (log: LocalWaterLog) => void
  /** Called when the user requests deletion of a specific log entry. */
  onDelete: (log: LocalWaterLog) => void
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
              <div class="bg-[#1a1d26] border border-white/8 rounded-[10px] py-2.5 px-4 flex items-center justify-between gap-3">
                <span class="text-sm font-medium">{formatTime(log.logged_at)}</span>
                <div class="flex items-center gap-3">
                  <span class="text-[13px] text-sky-400 font-semibold">{formatMl(log.amount_ml)}</span>
                  <button
                    type="button"
                    aria-label="Edit log"
                    class="text-[#7a7f96] hover:text-sky-400 cursor-pointer p-0.5 leading-none transition-colors"
                    onClick={() => props.onEdit(log)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Delete log"
                    class="text-[#7a7f96] hover:text-red-400 cursor-pointer p-0.5 leading-none transition-colors"
                    onClick={() => props.onDelete(log)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  )
}
