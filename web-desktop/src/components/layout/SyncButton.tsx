import { Show, createSignal, onCleanup } from 'solid-js'
import { syncEngine } from '../../db/sync'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { useOverlay } from '../../context/OverlayContext'

/** How long the "synced" checkmark lingers before reverting to the refresh icon. */
const SYNCED_FEEDBACK_MS = 1000

/**
 * A manual sync control. Tapping it pushes the current bottle state to the backend: the refresh icon spins while syncing, then briefly becomes a green checkmark on success before returning to the idle refresh icon. Repeated taps are ignored while a sync is already in flight. Runs the sync itself and surfaces a toast on failure, distinguishing being offline from a real error. When the user isn't signed in — the state in which sync is a no-op — it opens the sign-in dialog instead, so the button always leads somewhere.
 */
export function SyncButton() {
  const toast = useToast()
  const auth = useAuth()
  const overlay = useOverlay()
  const [status, setStatus] = createSignal<'idle' | 'syncing' | 'synced'>(
    'idle',
  )

  // Tracks the pending "synced → idle" timer so we can clear it if the component unmounts mid-feedback.
  let revertTimer: ReturnType<typeof setTimeout> | undefined

  async function handleClick() {
    if (status() === 'syncing') return

    // Syncing requires an account; without one syncEngine is a silent no-op. Prompt sign-in so the user understands why nothing synced and how to fix it. A successful sign-in kicks its own sync from the auth context.
    if (!auth.isLoggedIn()) {
      overlay.openLogin()
      return
    }

    setStatus('syncing')
    const result = await syncEngine()

    if (result.ok) {
      setStatus('synced')
      revertTimer = setTimeout(() => setStatus('idle'), SYNCED_FEEDBACK_MS)
    } else {
      setStatus('idle')
      // Distinguish being offline (changes are queued locally) from a backend error.
      if (!navigator.onLine) {
        toast.showToast(
          "You're offline — your changes will sync once you're back online.",
          'info',
        )
      } else {
        // Attach the request id (when the backend exposed one) so the user can report a precise support code.
        toast.showToast(
          'Sync failed. Please try again.',
          'error',
          result.requestId,
        )
      }
    }
  }

  onCleanup(() => clearTimeout(revertTimer))

  return (
    <button
      type="button"
      aria-label={status() === 'synced' ? 'Synced' : 'Sync now'}
      disabled={status() === 'syncing'}
      onClick={handleClick}
      class="text-[#7a7f96] hover:text-sky-400 cursor-pointer p-1 leading-none transition-colors disabled:cursor-progress"
    >
      <Show
        when={status() === 'synced'}
        fallback={
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            classList={{ 'animate-spin': status() === 'syncing' }}
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        }
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-emerald-400"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </Show>
    </button>
  )
}
