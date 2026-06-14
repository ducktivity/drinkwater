import { Show } from 'solid-js'
import { useOverlay } from '../context/OverlayContext'
import { ConfirmLogDialog } from './dialogs/ConfirmLogDialog'
import { DeleteLogDialog } from './dialogs/DeleteLogDialog'
import { EditLogDialog } from './dialogs/EditLogDialog'
import { AddLogDialog } from './dialogs/AddLogDialog'

/**
 * Renders the four modal dialogs, gated by the overlay context's visibility
 * state. Each dialog owns its own save/confirm logic and pulls what it needs
 * from context; this component only decides which ones are mounted.
 */
export function AppDialogs() {
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
        {(log) => <EditLogDialog log={log()} />}
      </Show>

      <Show when={overlay.logPendingDeletion()}>
        {(log) => <DeleteLogDialog log={log()} />}
      </Show>

      <Show when={overlay.isAddingLog()}>
        <AddLogDialog />
      </Show>
    </>
  )
}
