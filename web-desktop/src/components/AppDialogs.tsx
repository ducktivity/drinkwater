import { Show } from 'solid-js'
import { useHistory } from '../context/HistoryContext'
import { useOverlay } from '../context/OverlayContext'
import { ConfirmLogDialog } from './dialogs/ConfirmLogDialog'
import { DeleteLogDialog } from './dialogs/DeleteLogDialog'
import { EditLogDialog } from './dialogs/EditLogDialog'
import { AddLogDialog } from './dialogs/AddLogDialog'

/** Renders the four modal dialogs, driven by the overlay context state. */
export function AppDialogs() {
  const history = useHistory()
  const overlay = useOverlay()

  return (
    <>
      <Show when={overlay.isConfirmVisible()}>
        <ConfirmLogDialog
          amountMl={overlay.pendingLogMl}
          onConfirm={overlay.handleLogConfirm}
          onCancel={overlay.handleLogCancel}
        />
      </Show>

      <Show when={overlay.logBeingEdited()}>
        {(log) => (
          <EditLogDialog
            log={log()}
            onSave={overlay.handleEditSave}
            onCancel={() => overlay.setLogBeingEdited(null)}
          />
        )}
      </Show>

      <Show when={overlay.logPendingDeletion()}>
        {(log) => (
          <DeleteLogDialog
            log={log()}
            onConfirm={overlay.handleDeleteConfirm}
            onCancel={() => overlay.setLogPendingDeletion(null)}
          />
        )}
      </Show>

      <Show when={overlay.isAddingLog()}>
        <AddLogDialog
          dateKey={history.selectedDate()}
          onSave={overlay.handleAddLogSave}
          onCancel={() => overlay.setIsAddingLog(false)}
        />
      </Show>
    </>
  )
}
