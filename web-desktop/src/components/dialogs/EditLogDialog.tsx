import { createSignal } from 'solid-js'
import { clamp, toTimeInputValue, withTimeOfDay } from '../../utils'
import type { LocalWaterLog } from '../../db/db'

interface Props {
  /** The log entry being edited — used to seed the form fields. */
  log: LocalWaterLog
  /** Called with the edited amount (ml) and new ISO timestamp when saved. */
  onSave: (changes: { amount_ml: number; logged_at: string }) => void
  onCancel: () => void
}

/**
 * Modal dialog for editing a hydration log entry's time-of-day and amount.
 * The entry's date is preserved; only the local time and millilitres change.
 */
export function EditLogDialog(props: Props) {
  const [amountMl, setAmountMl] = createSignal(props.log.amount_ml)
  const [timeValue, setTimeValue] = createSignal(
    toTimeInputValue(props.log.logged_at),
  )

  function handleSave() {
    props.onSave({
      amount_ml: amountMl(),
      logged_at: withTimeOfDay(props.log.logged_at, timeValue()),
    })
  }

  return (
    <div class="fixed inset-0 bg-black/65 flex items-center justify-center z-100 p-5">
      <div class="bg-[#1a1d26] border border-white/8 rounded-2xl pt-7 px-6 pb-5 max-w-85 w-full">
        <div class="text-[36px] mb-3 text-center">✏️</div>
        <div class="text-[17px] font-semibold mb-5 text-center">Edit log</div>

        <div class="flex flex-col gap-3 mb-5">
          <label class="flex items-center justify-between gap-2.5">
            <span class="text-[13px] text-[#7a7f96]">Time</span>
            <input
              type="time"
              value={timeValue()}
              class="bg-[#222535] border border-white/8 rounded-lg text-[#f0f2f7] text-sm font-medium py-1.5 px-2.5 outline-none scheme-dark"
              onInput={(e) => setTimeValue(e.currentTarget.value)}
            />
          </label>

          <label class="flex items-center justify-between gap-2.5">
            <span class="text-[13px] text-[#7a7f96]">Amount</span>
            <div class="flex items-center gap-1.5">
              <input
                type="number"
                value={amountMl()}
                min="1"
                max="3000"
                step="50"
                class="bg-[#222535] border border-white/8 rounded-lg text-[#f0f2f7] text-sm font-medium w-18 py-1.5 px-2.5 text-right outline-none"
                onInput={(e) =>
                  setAmountMl(
                    clamp(parseInt(e.currentTarget.value) || 0, 1, 3000),
                  )
                }
              />
              <span class="text-[13px] text-[#7a7f96]">ml</span>
            </div>
          </label>
        </div>

        <div class="flex gap-2.5">
          <button
            class="flex-1 py-2.75 rounded-[10px] border-0 text-sm font-semibold cursor-pointer bg-[#222535] text-[#f0f2f7]"
            onClick={props.onCancel}
          >
            Cancel
          </button>
          <button
            class="flex-1 py-2.75 rounded-[10px] border-0 text-sm font-semibold cursor-pointer bg-sky-500 text-white"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
