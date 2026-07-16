import { Show } from 'solid-js'
import { useOverlay } from '../../context/OverlayContext'
import { ConfirmLogDialog } from './ConfirmLogDialog'
import { DeleteLogDialog } from './DeleteLogDialog'
import { EditLogDialog } from './EditLogDialog'
import { AddLogDialog } from './AddLogDialog'
import { ReminderModal } from './ReminderModal'
import { LoginDialog } from './LoginDialog'

/**
 * Renders the app's modal dialogs, gated by the overlay context's visibility state. Each dialog owns its own save/confirm logic and pulls what it needs from context; this component only decides which ones are mounted.
 */
export function AppDialogs() {
  const overlay = useOverlay()

  return (
    <>
      <Show when={overlay.isConfirmVisible()}>
        <ConfirmLogDialog />
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

      <Show when={overlay.isReminderVisible()}>
        <ReminderModal />
      </Show>

      <Show when={overlay.isLoginOpen()}>
        <LoginDialog onClose={overlay.closeLogin} />
      </Show>
    </>
  )
}
