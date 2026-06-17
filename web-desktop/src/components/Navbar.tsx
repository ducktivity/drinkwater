import { SyncButton } from './SyncButton'

interface Props {
  /** Runs a manual sync; resolves the outcome so SyncButton can show feedback. */
  onSync: () => Promise<boolean>
  /** Opens the settings drawer (preferences, schedule, reminders, account). */
  onOpenSettings: () => void
}

/**
 * The app's top bar: brand on the left, and the manual-sync control plus a
 * settings button on the right. Its inner content is constrained to the same
 * max width as the main card so the brand aligns with the card's left edge.
 */
export function Navbar(props: Props) {
  return (
    <header class="sticky top-0 z-40 w-full border-b border-white/8 bg-[#0f1117]/85 backdrop-blur">
      <div class="mx-auto flex w-full max-w-105 items-center justify-between px-4 py-3">
        <div class="text-[15px] font-semibold text-[#f0f2f7]">
          💧 Drinkwater
        </div>

        <div class="flex items-center gap-1">
          <SyncButton onSync={props.onSync} />

          <button
            type="button"
            aria-label="Settings"
            onClick={props.onOpenSettings}
            class="text-[#7a7f96] hover:text-sky-400 cursor-pointer p-1 leading-none transition-colors"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
