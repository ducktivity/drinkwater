import { formatMl } from '../../utils'
import { db, type LocalWaterLog } from '../../db/db'
import { syncEngine } from '../../db/sync'
import { logger } from '../../logger'
import { useOverlay } from '../../context/OverlayContext'
import { useHistory } from '../../context/HistoryContext'

interface Props {
  /** The log entry pending deletion — displayed in the confirmation message. */
  log: LocalWaterLog
}

/**
 * Modal dialog asking the user to confirm removal of a logged hydration entry.
 *
 * A log that has never been pushed to the backend (`is_synced === 0`) is removed permanently from IndexedDB — no other device has ever seen it, so there is nothing to soft-delete and propagate. An already-synced log is soft-deleted: flagged deleted and unsynced so the deletion syncs out to the backend (and from there to other devices).
 */
export function DeleteLogDialog(props: Props) {
  const overlay = useOverlay()
  const history = useHistory()

  /**
   * Removes the log. Unsynced logs are hard-deleted from IndexedDB; synced logs are soft-deleted (flagged deleted + unsynced) and a background sync is kicked off to propagate the deletion to the backend.
   */
  async function handleDeleteConfirm() {
    if (props.log.is_synced === 0) {
      // Never reached the server, so it lives only in this IndexedDB. Delete it outright rather than keeping a soft-deleted tombstone nothing will sync.
      await db.waterLogs.delete(props.log.id)
      // Drive the history view off a deleted copy so it drops from past-day lists.
      history.syncHistoryView({ ...props.log, is_deleted: true })
      overlay.setLogPendingDeletion(null)
      return
    }

    // Upsert the full record (rather than update by id): a historical log fetched from the backend may not exist in IndexedDB yet, so we must write it in full — flagged deleted and unsynced — for the soft-delete to propagate on sync.
    const deleted: LocalWaterLog = {
      ...props.log,
      is_deleted: true,
      is_synced: 0,
    }
    await db.waterLogs.put(deleted)
    history.syncHistoryView(deleted)
    overlay.setLogPendingDeletion(null)
    syncEngine().catch(logger.error)
  }

  return (
    <div class="fixed inset-0 bg-black/65 flex items-center justify-center z-100 p-5">
      <div class="bg-[#1a1d26] border border-white/8 rounded-2xl pt-7 px-6 pb-5 max-w-85 w-full text-center">
        <div class="text-[36px] mb-3">🗑️</div>
        <div class="text-[17px] font-semibold mb-2 text-white">
          Delete this log?
        </div>
        <div class="text-sm/normal text-[#7a7f96] mb-5 ">
          Remove the {formatMl(props.log.amount_ml)} entry? This can't be
          undone.
        </div>
        <div class="flex gap-2.5">
          <button
            class="flex-1 py-2.75 rounded-[10px] border-0 text-sm font-semibold cursor-pointer bg-[#222535] text-[#f0f2f7]"
            onClick={() => overlay.setLogPendingDeletion(null)}
          >
            Keep it
          </button>
          <button
            class="flex-1 py-2.75 rounded-[10px] border-0 text-sm font-semibold cursor-pointer bg-red-500 text-white"
            onClick={handleDeleteConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
