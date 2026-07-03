import { Show } from 'solid-js'
import { useAuth } from '../../context/AuthContext'
import { useOverlay } from '../../context/OverlayContext'

/**
 * The account row in the settings area: a "Sign in to sync" entry when logged out, or the signed-in email with a sign-out action. Opens the shared sign-in dialog (rendered in AppDialogs) through the overlay context.
 */
export function AccountSection() {
  const auth = useAuth()
  const overlay = useOverlay()

  return (
    <div class="w-full">
      <Show
        when={auth.user()}
        fallback={
          <button
            class="w-full cursor-pointer rounded-[10px] border-0 bg-[#222535] py-2.75 text-sm font-semibold text-[#f0f2f7]"
            onClick={overlay.openLogin}
          >
            Sign in to sync
          </button>
        }
      >
        {(user) => (
          <div class="flex items-center justify-between gap-2.5">
            <div class="flex min-w-0 flex-col">
              <span class="text-[13px] text-[#7a7f96]">Signed in</span>
              <span class="truncate text-sm text-[#f0f2f7]">
                {user().email}
              </span>
            </div>
            <button
              class="cursor-pointer rounded-[10px] border-0 bg-[#222535] px-3.5 py-2 text-[13px] font-semibold text-[#f0f2f7]"
              onClick={auth.signOut}
            >
              Sign out
            </button>
          </div>
        )}
      </Show>
    </div>
  )
}
