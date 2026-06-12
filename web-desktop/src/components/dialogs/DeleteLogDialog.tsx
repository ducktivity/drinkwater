import { formatMl } from '../../utils'
import type { LocalWaterLog } from '../../db/db'

interface Props {
  /** The log entry pending deletion — displayed in the confirmation message. */
  log: LocalWaterLog
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Modal dialog asking the user to confirm removal of a logged hydration entry.
 * Deleting is a soft-delete: the entry is flagged and synced to the backend.
 */
export function DeleteLogDialog(props: Props) {
  return (
    <div class="fixed inset-0 bg-black/65 flex items-center justify-center z-100 p-5">
      <div class="bg-[#1a1d26] border border-white/8 rounded-2xl pt-7 px-6 pb-5 max-w-85 w-full text-center">
        <div class="text-[36px] mb-3">🗑️</div>
        <div class="text-[17px] font-semibold mb-2">Delete this log?</div>
        <div class="text-sm/normal text-[#7a7f96] mb-5 ">
          Remove the {formatMl(props.log.amount_ml)} entry? This can't be undone.
        </div>
        <div class="flex gap-2.5">
          <button
            class="flex-1 py-2.75 rounded-[10px] border-0 text-sm font-semibold cursor-pointer bg-[#222535] text-[#f0f2f7]"
            onClick={props.onCancel}
          >
            Keep it
          </button>
          <button
            class="flex-1 py-2.75 rounded-[10px] border-0 text-sm font-semibold cursor-pointer bg-red-500 text-white"
            onClick={props.onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
