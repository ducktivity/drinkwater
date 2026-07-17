import { createEffect, createSignal, Show } from 'solid-js'
import { useAuth } from '../../context/AuthContext'
import { useOverlay } from '../../context/OverlayContext'
import { useToast } from '../../context/ToastContext'
import { syncEngine } from '../../db/sync'
import {
  clearSyncedLocalLogs,
  estimateReclaimableStorage,
} from '../../db/cleanup'
import { formatBytes } from '../../utils'
import { logger } from '../../logger'

/**
 * The storage row in the settings drawer: a Google-Photos-style "free up space" control. Past logs persist locally so history loads instantly and stays available offline; this lets the user reclaim that space once it's backed up to the cloud.
 *
 * Clicking syncs first (so nothing is dropped before the server holds it), then deletes the local copies of already-synced past days — today's logs and any unsynced edits are always kept. Cleared days re-download on demand. Only available when signed in, since cleanup relies on the cloud copy.
 */
export function StorageSection() {
  const auth = useAuth()
  const overlay = useOverlay()
  const toast = useToast()

  // Estimated bytes reclaimable by a cleanup, refreshed whenever the drawer opens. Zero until computed.
  const [reclaimableBytes, setReclaimableBytes] = createSignal(0)
  const [isBusy, setIsBusy] = createSignal(false)

  /** Recomputes the reclaimable estimate from IndexedDB. */
  async function refreshEstimate() {
    const { bytes } = await estimateReclaimableStorage()
    setReclaimableBytes(bytes)
  }

  // Refresh the estimate each time the drawer opens (and once signed in), so the figure reflects logs added since it was last shown.
  createEffect(() => {
    if (overlay.isSettingsOpen() && auth.isLoggedIn()) {
      refreshEstimate().catch(logger.error)
    }
  })

  /** Syncs to the cloud, then frees the local copies of synced past-day logs. */
  async function handleCleanup() {
    setIsBusy(true)
    try {
      // Push anything unsynced first — cleanup only deletes rows the server already holds, so a failed sync must abort before we remove anything.
      const result = await syncEngine()
      if (!result.ok) {
        toast.showToast(
          "Couldn't sync to the cloud, so nothing was removed. Please try again.",
          'error',
          result.requestId,
        )
        return
      }

      const freed = await clearSyncedLocalLogs()
      await refreshEstimate()
      toast.showToast(
        `Freed ${formatBytes(freed.bytes)} of local storage.`,
        'info',
      )
    } catch (err) {
      logger.error(err)
      toast.showToast('Storage cleanup failed. Please try again.', 'error')
    } finally {
      setIsBusy(false)
    }
  }

  const hasReclaimable = () => reclaimableBytes() > 0

  return (
    <div class="w-full">
      <Show
        when={auth.isLoggedIn()}
        fallback={
          <p class="text-[13px] text-[#7a7f96]">
            Sign in to sync your history and free up space on this device.
          </p>
        }
      >
        <p class="mb-3 text-[13px] text-[#7a7f96]">
          Your history stays on this device for instant, offline access. Once
          it's backed up to the cloud you can clear the local copies to save
          space.
        </p>
        <button
          type="button"
          disabled={isBusy() || !hasReclaimable()}
          class="w-full cursor-pointer rounded-[10px] border-0 bg-[#222535] py-2.75 text-sm font-semibold text-[#f0f2f7] disabled:cursor-not-allowed disabled:opacity-40"
          onClick={handleCleanup}
        >
          <Show when={!isBusy()} fallback="Freeing up space…">
            <Show
              when={hasReclaimable()}
              fallback="No local storage to free up"
            >
              Free up ~{formatBytes(reclaimableBytes())}
            </Show>
          </Show>
        </button>
      </Show>
    </div>
  )
}
