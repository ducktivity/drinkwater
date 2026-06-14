import { createSignal } from 'solid-js'
import { toTimeInputValue, withTimeOfDay } from '../../utils'
import { db, type LocalWaterLog } from '../../db/db'
import { syncEngine } from '../../db/sync'
import { useOverlay } from '../../context/OverlayContext'
import { useHistory } from '../../context/HistoryContext'
import { NumberInput } from '../ui/NumberInput'
import { TimeInput } from '../ui/TimeInput'

interface Props {
  /** The log entry being edited — used to seed the form fields. */
  log: LocalWaterLog
}

/**
 * Modal dialog for editing a hydration log entry's time-of-day and amount.
 * The entry's date is preserved; only the local time and millilitres change.
 */
export function EditLogDialog(props: Props) {
  const overlay = useOverlay()
  const history = useHistory()
  const [amountMl, setAmountMl] = createSignal(props.log.amount_ml)
  const [timeValue, setTimeValue] = createSignal(
    toTimeInputValue(props.log.logged_at),
  )

  /**
   * Persists edits to the log: updates the amount and timestamp, flags it as
   * unsynced in IndexedDB, then kicks off a background sync to the backend.
   */
  async function handleSave() {
    const log = props.log
    const changes = {
      amount_ml: amountMl(),
      logged_at: withTimeOfDay(log.logged_at, timeValue()),
    }

    // Nothing changed — close the dialog without touching the sync state.
    // Timestamps are compared at local minute granularity (matching the time
    // input's precision) so equivalent instants in different ISO formats
    // (e.g. "...Z" vs "...+08:00") don't register as a spurious change.
    const isUnchanged =
      changes.amount_ml === log.amount_ml &&
      toTimeInputValue(changes.logged_at) === toTimeInputValue(log.logged_at)
    if (isUnchanged) {
      overlay.setLogBeingEdited(null)
      return
    }

    // Upsert the full record: a historical log fetched from the backend may not
    // be present in IndexedDB, so writing it in full (rather than update-by-id)
    // ensures the edit is persisted and queued for sync in both cases.
    const updated: LocalWaterLog = { ...log, ...changes, is_synced: 0 }
    await db.waterLogs.put(updated)
    history.syncHistoryView(updated)
    overlay.setLogBeingEdited(null)
    syncEngine().catch(console.error)
  }

  return (
    <div class="fixed inset-0 bg-black/65 flex items-center justify-center z-100 p-5">
      <div class="bg-[#1a1d26] border border-white/8 rounded-2xl pt-7 px-6 pb-5 max-w-85 w-full">
        <div class="text-[36px] mb-3 text-center">✏️</div>
        <div class="text-[17px] font-semibold mb-5 text-center text-white">
          Edit log
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
            onClick={() => overlay.setLogBeingEdited(null)}
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
