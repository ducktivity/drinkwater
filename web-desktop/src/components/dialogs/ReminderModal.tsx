import { useOverlay } from '../../context/OverlayContext'

/**
 * The drink-water reminder modal. Raised by the reminder engine when the interval elapses, on top of the native nudges (sound, taskbar flash, window pop). It's deliberately loud — a tinted backdrop and a pulsing water drop — so it can't be tuned out. Both answers ("Yes" / "Not yet") simply dismiss it; the next reminder arrives when the interval next elapses.
 */
export function ReminderModal() {
  const overlay = useOverlay()

  return (
    <div class="fixed inset-0 bg-sky-950/80 flex items-center justify-center z-200 p-5 backdrop-blur-sm">
      <div class="bg-[#1a1d26] border border-sky-400/30 rounded-2xl shadow-2xl shadow-sky-500/20 pt-8 px-6 pb-5 max-w-85 w-full text-center">
        <div class="text-[52px] mb-3 animate-bounce">💧</div>
        <div class="text-xl font-bold mb-2 text-white">Time to hydrate!</div>
        <div class="text-sm/normal text-[#9aa0b8] mb-6">
          You've gone a while without water. Have you had a drink?
        </div>
        <div class="flex gap-2.5">
          <button
            class="flex-1 py-3 rounded-[10px] border-0 text-sm font-semibold cursor-pointer bg-[#222535] text-[#f0f2f7]"
            onClick={overlay.dismissReminder}
          >
            Not yet
          </button>
          <button
            class="flex-1 py-3 rounded-[10px] border-0 text-sm font-semibold cursor-pointer bg-sky-500 text-white"
            onClick={overlay.dismissReminder}
          >
            Yes, I drank 💪
          </button>
        </div>
      </div>
    </div>
  )
}
