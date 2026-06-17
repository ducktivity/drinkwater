import { For, Show } from 'solid-js'
import { formatTime, formatMl, formatFullDay } from '../../utils'
import { useHistory } from '../../context/HistoryContext'
import { useOverlay } from '../../context/OverlayContext'

/**
 * Renders the selected day's individual hydration log entries with edit/delete
 * controls. Reads the entries (today's live logs or a fetched past day) from the
 * history context and routes edit/delete/add intents through the overlay
 * context. On past days it also offers an "Add log" button to back-fill a
 * forgotten entry; today's logs are captured through the bottle instead.
 */
export function LogList() {
  const history = useHistory()
  const overlay = useOverlay()

  /** Section heading: a friendly "today" label, or the past day's full date. */
  const title = () =>
    history.isViewingToday()
      ? "Today's Progress"
      : formatFullDay(history.selectedDate())

  return (
    <div class="w-full max-w-105 mt-5">
      <div class="flex items-center justify-between mb-2.5 px-0.5">
        <div class="text-[13px] font-semibold text-[#7a7f96] uppercase tracking-[0.5px]">
          {title()}
        </div>
        {/* Back-filling only applies to past days; today is logged via the bottle. */}
        <Show when={!history.isViewingToday()}>
          <button
            type="button"
            class="flex items-center gap-1 text-[13px] font-semibold text-sky-400 cursor-pointer"
            onClick={() => overlay.setIsAddingLog(true)}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add log
          </button>
        </Show>
      </div>

      <div class="flex flex-col gap-1.5">
        <Show
          when={!history.isLoadingHistory()}
          fallback={
            <div class="text-[13px] text-[#7a7f96] py-2.5 px-4">Loading…</div>
          }
        >
          <Show
            when={history.displayedLogs().length > 0}
            fallback={
              <div class="text-[13px] text-[#7a7f96] py-2.5 px-4">
                Nothing logged for this day.
              </div>
            }
          >
            <For each={history.displayedLogs()}>
              {(log) => (
                <div class="bg-[#1a1d26] border border-white/8 rounded-[10px] py-2.5 px-4 flex items-center justify-between gap-3">
                  <span class="text-sm font-medium">
                    {formatTime(log.logged_at)}
                  </span>
                  <div class="flex items-center gap-3">
                    <span class="text-[13px] text-sky-400 font-semibold">
                      {formatMl(log.amount_ml)}
                    </span>
                    <button
                      type="button"
                      aria-label="Edit log"
                      class="text-[#7a7f96] hover:text-sky-400 cursor-pointer p-0.5 leading-none transition-colors"
                      onClick={() => overlay.setLogBeingEdited(log)}
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
                      onClick={() => overlay.setLogPendingDeletion(log)}
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
        </Show>
      </div>
    </div>
  )
}
