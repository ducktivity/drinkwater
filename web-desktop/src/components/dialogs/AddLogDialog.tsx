import { createSignal } from 'solid-js'
import {
  isoFromDateAndTime,
  toTimeInputValue,
  formatFullDay,
} from '../../utils'
import { db, type LocalWaterLog } from '../../db/db'
import { syncEngine } from '../../db/sync'
import { logger } from '../../logger'
import { useOverlay } from '../../context/OverlayContext'
import { useHistory } from '../../context/HistoryContext'
import { NumberInput } from '../ui/NumberInput'
import { TimeInput } from '../ui/TimeInput'

/** Default fill for a forgotten log the user is back-filling, in millilitres. */
const DEFAULT_AMOUNT_ML = 250

/**
 * Modal dialog for adding a hydration log to a past day the user forgot to
 * record. Mirrors EditLogDialog's layout but composes a brand-new entry on the
 * selected calendar day from the chosen time-of-day and amount.
 */
export function AddLogDialog() {
  const overlay = useOverlay()
  const history = useHistory()
  const [amountMl, setAmountMl] = createSignal(DEFAULT_AMOUNT_ML)
  // Seed the time with the current clock time as a sensible starting point.
  const [timeValue, setTimeValue] = createSignal(
    toTimeInputValue(new Date().toISOString()),
  )

  /**
   * Adds a back-filled log to the selected (past) day: writes a new unsynced
   * entry to IndexedDB, reflects it in the history list, and kicks off a sync.
   */
  async function handleSave() {
    const newLog: LocalWaterLog = {
      id: crypto.randomUUID(),
      amount_ml: amountMl(),
      logged_at: isoFromDateAndTime(history.selectedDate(), timeValue()),
      is_deleted: false,
      is_synced: 0,
    }
    await db.waterLogs.add(newLog)
    history.syncHistoryView(newLog)
    overlay.setIsAddingLog(false)
    syncEngine().catch(logger.error)
  }

  return (
    <div class="fixed inset-0 bg-black/65 flex items-center justify-center z-100 p-5">
      <div class="bg-[#1a1d26] border border-white/8 rounded-2xl pt-7 px-6 pb-5 max-w-85 w-full">
        <div class="text-[36px] mb-3 text-center">💧</div>
        <div class="text-[17px] font-semibold mb-1 text-center text-white">
          Add a log
        </div>
        <div class="text-[13px] text-[#7a7f96] mb-5 text-center">
          {formatFullDay(history.selectedDate())}
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
            onClick={() => overlay.setIsAddingLog(false)}
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
