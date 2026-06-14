import { createSignal } from 'solid-js'
import {
  isoFromDateAndTime,
  toTimeInputValue,
  formatFullDay,
} from '../../utils'
import { NumberInput } from '../ui/NumberInput'
import { TimeInput } from '../ui/TimeInput'

interface Props {
  /** The day to attach the new log to, as a YYYY-MM-DD key. */
  dateKey: string
  /** Called with the new amount (ml) and composed ISO timestamp when saved. */
  onSave: (changes: { amount_ml: number; logged_at: string }) => void
  onCancel: () => void
}

/** Default fill for a forgotten log the user is back-filling, in millilitres. */
const DEFAULT_AMOUNT_ML = 250

/**
 * Modal dialog for adding a hydration log to a past day the user forgot to
 * record. Mirrors EditLogDialog's layout but composes a brand-new entry on the
 * selected calendar day from the chosen time-of-day and amount.
 */
export function AddLogDialog(props: Props) {
  const [amountMl, setAmountMl] = createSignal(DEFAULT_AMOUNT_ML)
  // Seed the time with the current clock time as a sensible starting point.
  const [timeValue, setTimeValue] = createSignal(
    toTimeInputValue(new Date().toISOString()),
  )

  function handleSave() {
    props.onSave({
      amount_ml: amountMl(),
      logged_at: isoFromDateAndTime(props.dateKey, timeValue()),
    })
  }

  return (
    <div class="fixed inset-0 bg-black/65 flex items-center justify-center z-100 p-5">
      <div class="bg-[#1a1d26] border border-white/8 rounded-2xl pt-7 px-6 pb-5 max-w-85 w-full">
        <div class="text-[36px] mb-3 text-center">💧</div>
        <div class="text-[17px] font-semibold mb-1 text-center">Add a log</div>
        <div class="text-[13px] text-[#7a7f96] mb-5 text-center">
          {formatFullDay(props.dateKey)}
        </div>

        <div class="flex flex-col gap-3 mb-5">
          <label class="flex items-center justify-between gap-2.5">
            <span class="text-[13px] text-[#7a7f96]">Time</span>
            <TimeInput value={timeValue()} eager onValueChange={setTimeValue} />
          </label>

          <label class="flex items-center justify-between gap-2.5">
            <span class="text-[13px] text-[#7a7f96]">Amount</span>
            <NumberInput
              value={amountMl()}
              step={50}
              unit="ml"
              fallback={1}
              eager
              onValueChange={setAmountMl}
            />
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
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
