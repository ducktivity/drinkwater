import { formatMl } from '../../utils'

interface Props {
  /** Amount in ml the dialog will commit when confirmed — displayed in the message. */
  amountMl: () => number
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Modal dialog that appears before committing a water log, either when the user
 * drags the bottle to empty or taps "Log drank". Asks the user to confirm the
 * amount before it is recorded.
 */
export function ConfirmLogDialog(props: Props) {
  return (
    <div class="fixed inset-0 bg-black/65 flex items-center justify-center z-100 p-5">
      <div class="bg-[#1a1d26] border border-white/8 rounded-2xl pt-7 px-6 pb-5 max-w-85 w-full text-center">
        <div class="text-[36px] mb-3">🧊</div>
        <div class="text-[17px] font-semibold mb-2">Log this drink?</div>
        <div class="text-sm/normal text-[#7a7f96] mb-5 ">
          Add {formatMl(props.amountMl())} to today's total?
        </div>
        <div class="flex gap-2.5">
          <button
            class="flex-1 py-2.75 rounded-[10px] border-0 text-sm font-semibold cursor-pointer bg-[#222535] text-[#f0f2f7]"
            onClick={props.onCancel}
          >
            Not yet
          </button>
          <button
            class="flex-1 py-2.75 rounded-[10px] border-0 text-sm font-semibold cursor-pointer bg-sky-500 text-white"
            onClick={props.onConfirm}
          >
            Yes, log it!
          </button>
        </div>
      </div>
    </div>
  )
}
