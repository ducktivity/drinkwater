import { Show, createSignal, onCleanup } from 'solid-js'
import { syncEngine } from '../../db/sync'
import { useToast } from '../../context/ToastContext'

/** How long the "synced" checkmark lingers before reverting to the refresh icon. */
const SYNCED_FEEDBACK_MS = 1000

/**
 * A manual sync control. Tapping it pushes the current bottle state to the
 * backend: the refresh icon spins while syncing, then briefly becomes a green
 * checkmark on success before returning to the idle refresh icon. Repeated taps
 * are ignored while a sync is already in flight. Runs the sync itself and
 * surfaces a toast on failure, distinguishing being offline from a real error.
 */
export function SyncButton() {
  const toast = useToast()
  const [status, setStatus] = createSignal<'idle' | 'syncing' | 'synced'>(
    'idle',
  )

  // Tracks the pending "synced → idle" timer so we can clear it if the
  // component unmounts mid-feedback.
  let revertTimer: ReturnType<typeof setTimeout> | undefined

  async function handleClick() {
    if (status() === 'syncing') return

    setStatus('syncing')
    const succeeded = await syncEngine()

    if (succeeded) {
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
        toast.showToast('Sync failed. Please try again.', 'error')
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
