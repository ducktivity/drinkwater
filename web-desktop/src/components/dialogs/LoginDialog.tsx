import { createSignal, Show } from 'solid-js'
import { requestCode } from '../../db/auth'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

interface Props {
  /** Closes the dialog (cancel, or after a successful sign-in). */
  onClose: () => void
}

/**
 * Two-step passwordless sign-in: enter an email to receive a 6-digit code, then enter the code to start syncing. Until this completes the app stays fully local, so the dialog is dismissable at any point with no side effects.
 */
export function LoginDialog(props: Props) {
  const auth = useAuth()
  const toast = useToast()

  // 'email' collects the address and requests a code; 'code' verifies it.
  const [step, setStep] = createSignal<'email' | 'code'>('email')
  const [email, setEmail] = createSignal('')
  const [code, setCode] = createSignal('')
  const [error, setError] = createSignal<string | null>(null)
  const [busy, setBusy] = createSignal(false)

  /** Requests a login code for the entered email and advances to the code step. */
  async function handleSendCode(event: Event) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    const failure = await requestCode(email().trim())
    setBusy(false)
    if (failure) {
      setError(failure)
      return
    }
    toast.showToast(`We sent a code to ${email().trim()}.`, 'info')
    setStep('code')
  }

  /** Verifies the code; on success closes the dialog (sign-in + sync happen in context). */
  async function handleVerify(event: Event) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    const failure = await auth.verify(email().trim(), code().trim())
    setBusy(false)
    if (failure) {
      setError(failure)
      return
    }
    toast.showToast('Signed in — your logs will now sync.', 'info')
    props.onClose()
  }

  return (
    <div class="fixed inset-0 z-100 flex items-center justify-center bg-black/65 p-5">
      <div class="w-full max-w-85 rounded-2xl border border-white/8 bg-[#1a1d26] px-6 pb-5 pt-7">
        <div class="mb-3 text-center text-[36px]">🔑</div>
        <div class="mb-1 text-center text-[17px] font-semibold text-white">
          Sign in to sync
        </div>
        <div class="mb-5 text-center text-[13px] text-[#7a7f96]">
          <Show
            when={step() === 'email'}
            fallback={`Enter the 6-digit code sent to ${email().trim()}.`}
          >
            We'll email you a one-time code. No password needed.
          </Show>
        </div>

        <Show
          when={step() === 'email'}
          fallback={
            <form class="mb-5 flex flex-col gap-3" onSubmit={handleVerify}>
              <input
                class="w-full rounded-[10px] border border-white/8 bg-[#222535] px-3 py-2.75 text-center text-lg tracking-[6px] text-[#f0f2f7] outline-none"
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="6"
                placeholder="000000"
                value={code()}
                onInput={(event) => setCode(event.currentTarget.value)}
              />
              <Show when={error()}>
                <div class="text-center text-[13px] text-red-400">
                  {error()}
                </div>
              </Show>
              <div class="flex gap-2.5">
                <button
                  type="button"
                  class="flex-1 cursor-pointer rounded-[10px] border-0 bg-[#222535] py-2.75 text-sm font-semibold text-[#f0f2f7]"
                  onClick={() => {
                    setError(null)
                    setStep('email')
                  }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={busy() || code().trim().length === 0}
                  class="flex-1 cursor-pointer rounded-[10px] border-0 bg-sky-500 py-2.75 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy() ? 'Verifying…' : 'Verify'}
                </button>
              </div>
            </form>
          }
        >
          <form class="mb-5 flex flex-col gap-3" onSubmit={handleSendCode}>
            <input
              class="w-full rounded-[10px] border border-white/8 bg-[#222535] px-3 py-2.75 text-sm text-[#f0f2f7] outline-none"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
              value={email()}
              onInput={(event) => setEmail(event.currentTarget.value)}
            />
            <Show when={error()}>
              <div class="text-center text-[13px] text-red-400">{error()}</div>
            </Show>
            <div class="flex gap-2.5">
              <button
                type="button"
                class="flex-1 cursor-pointer rounded-[10px] border-0 bg-[#222535] py-2.75 text-sm font-semibold text-[#f0f2f7]"
                onClick={props.onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy() || email().trim().length === 0}
                class="flex-1 cursor-pointer rounded-[10px] border-0 bg-sky-500 py-2.75 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy() ? 'Sending…' : 'Send code'}
              </button>
            </div>
          </form>
        </Show>
      </div>
    </div>
  )
}
