import { For, Show, createSignal, onCleanup } from 'solid-js'
import { useToast, type Toast } from '../../context/ToastContext'

/** Per-type accent colour for the toast's left border and icon. */
const ACCENT: Record<Toast['type'], string> = {
  error: 'border-l-rose-500 text-rose-400',
  info: 'border-l-amber-400 text-amber-300',
}

/** How long the "Copied" confirmation lingers after copying the error code. */
const COPIED_FEEDBACK_MS = 1500

/**
 * The support code line for an error toast: the backend request id shown in muted monospace plus a button that copies the full id to the clipboard. Lets a user report a precise code that pinpoints the failing request in the logs.
 */
function ToastErrorCode(props: { code: string }) {
  const [copied, setCopied] = createSignal(false)
  let resetTimer: ReturnType<typeof setTimeout> | undefined

  async function copy() {
    try {
      await navigator.clipboard.writeText(props.code)
      setCopied(true)
      clearTimeout(resetTimer)
      resetTimer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
    } catch {
      // Clipboard access can be denied (e.g. insecure context); the code stays visible for the user to copy manually, so there's nothing to recover.
    }
  }

  onCleanup(() => clearTimeout(resetTimer))

  return (
    <div class="flex items-center gap-1.5">
      <span class="min-w-0 truncate font-mono text-[11px] text-[#7a7f96]">
        {props.code}
      </span>
      <button
        type="button"
        onClick={copy}
        class="shrink-0 cursor-pointer text-[11px] text-[#7a7f96] underline underline-offset-2 transition-colors hover:text-[#f0f2f7]"
      >
        {copied() ? 'Copied' : 'Copy error code'}
      </button>
    </div>
  )
}

/**
 * Renders the stack of active toasts in the bottom-right corner. Each toast shows a status icon, the message, and a dismiss button; they auto-expire via the toast context. Purely presentational — all state lives in ToastProvider.
 */
export function ToastContainer() {
  const { toasts, dismissToast } = useToast()

  return (
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <For each={toasts()}>
        {(toast) => (
          <div
            role="status"
            class={`flex max-w-80 items-start gap-2.5 rounded-lg border border-white/8 border-l-4 bg-[#222535] py-2.5 pr-2.5 pl-3 shadow-lg ${ACCENT[toast.type]}`}
          >
            <span class="mt-0.5 shrink-0">
              <Show
                when={toast.type === 'error'}
                fallback={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                }
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4" />
                  <path d="M12 16h.01" />
                </svg>
              </Show>
            </span>

            <div class="flex min-w-0 flex-1 flex-col gap-1.5">
              <span class="text-[13px] leading-snug text-[#f0f2f7]">
                {toast.message}
              </span>
              <Show when={toast.requestId}>
                {(code) => <ToastErrorCode code={code()} />}
              </Show>
            </div>

            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismissToast(toast.id)}
              class="shrink-0 cursor-pointer p-0.5 leading-none text-[#7a7f96] transition-colors hover:text-[#f0f2f7]"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </For>
    </div>
  )
}
