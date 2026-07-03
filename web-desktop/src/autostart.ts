/**
 * Run-on-startup control for the desktop shell. Backed by Tauri's autostart plugin, which registers/removes the OS login entry (the Windows registry Run key). All functions are no-ops/false on the web build, where there's no OS login concept to hook into.
 */

/**
 * Whether we're running inside the Tauri desktop shell (vs. a plain browser). Tauri injects `__TAURI_INTERNALS__` onto the window, so its presence is a reliable, import-free way to gate the native-only autostart calls.
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** Whether run-on-startup can be configured in this environment (desktop only). */
export function isAutostartSupported(): boolean {
  return isTauri()
}

/** Reports whether the app is currently registered to launch at login. */
export async function isAutostartEnabled(): Promise<boolean> {
  if (!isTauri()) return false
  const { isEnabled } = await import('@tauri-apps/plugin-autostart')
  return isEnabled()
}

/** Registers (true) or removes (false) the app's launch-at-login entry. */
export async function setAutostart(enabled: boolean): Promise<void> {
  if (!isTauri()) return
  const { enable, disable } = await import('@tauri-apps/plugin-autostart')
  await (enabled ? enable() : disable())
}
