import { createSignal, onMount } from 'solid-js'
import { isAutostartEnabled, setAutostart } from '../../autostart'
import { logger } from '../../logger'
import { ToggleSwitch } from '../ui/ToggleSwitch'

/**
 * Desktop-only toggle for launching Drinkwater automatically when Windows starts. The switch reflects the actual OS login entry (queried once on mount) rather than a synced setting, since run-on-startup is a per-machine choice. On startup the app launches hidden in the tray (see the Rust `--autostart` handling), so enabling this won't pop a window in the user's face at login.
 */
export function StartupSettings() {
  const [enabled, setEnabled] = createSignal(false)

  // Reflect the real OS state when the drawer first mounts.
  onMount(() => {
    isAutostartEnabled().then(setEnabled).catch(logger.error)
  })

  /**
   * Optimistically flips the switch, then registers/removes the login entry. On failure we roll the toggle back so it never lies about the OS state.
   */
  function handleChange(next: boolean) {
    setEnabled(next)
    setAutostart(next).catch((error) => {
      logger.error('Failed to update run-on-startup setting', error)
      setEnabled(!next)
    })
  }

  return (
    <ToggleSwitch
      checked={enabled()}
      label="Launch on startup"
      onChange={handleChange}
    />
  )
}
