import { createEffect, onCleanup } from 'solid-js'

/**
 * User-configurable settings for the gentle drink-water reminder: a periodic
 * nudge to drink water, counted from the last logged drink.
 */
export interface ReminderSettings {
  /** Master switch for the reminder. */
  enabled: boolean
  /** Minutes between reminders (counted from the last drink). */
  intervalMin: number
}

/** Sensible default: a gentle nudge every hour, off until the user opts in. */
export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  intervalMin: 60,
}

/** Title/body shared by both the desktop and browser notifications. */
const REMINDER_TITLE = 'Time to hydrate 💧'
const REMINDER_BODY = 'Take a sip of water to stay on track.'

/**
 * Whether we're running inside the Tauri desktop shell (vs. a plain browser).
 * Tauri injects `__TAURI_INTERNALS__` onto the window, so its presence is a
 * reliable, import-free way to branch between the native and web reminder paths.
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * Whether reminders can be surfaced in this environment. Always true on desktop
 * (Tauri ships its own notification plugin); on the web it depends on the
 * browser exposing the Notification API.
 */
export function isNotificationSupported(): boolean {
  if (isTauri()) return true
  return typeof window !== 'undefined' && 'Notification' in window
}

/**
 * Ensures we have permission to show notifications, prompting the user once if
 * the permission has not yet been decided. Resolves to true when granted.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (isTauri()) {
    const { isPermissionGranted, requestPermission } =
      await import('@tauri-apps/plugin-notification')
    if (await isPermissionGranted()) return true
    return (await requestPermission()) === 'granted'
  }
  if (!isNotificationSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

/**
 * Forces the desktop window to the foreground so the reminder is impossible to
 * miss: unminimize and show it (in case it was minimized or hidden), pull focus,
 * and briefly pin it on top. The always-on-top pin works around Windows'
 * foreground-lock, which would otherwise leave a programmatically-focused window
 * buried behind whatever app the user is currently in. The pin is released a
 * few seconds later so the window behaves normally once it's been noticed.
 */
async function forceWindowToFront(): Promise<void> {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  const win = getCurrentWindow()
  await win.unminimize()
  await win.show()
  await win.setAlwaysOnTop(true)
  await win.setFocus()
  setTimeout(() => {
    win.setAlwaysOnTop(false).catch(() => {
      /* Window may have closed; nothing to restore. */
    })
  }, 4000)
}

/**
 * Fires a single drink-water reminder. On desktop this sends a native OS
 * notification and forces the window to pop to the foreground; on the web it
 * falls back to a passive browser notification (no window control available).
 */
async function fireReminder(): Promise<void> {
  if (isTauri()) {
    try {
      const { isPermissionGranted, sendNotification } =
        await import('@tauri-apps/plugin-notification')
      if (await isPermissionGranted()) {
        sendNotification({ title: REMINDER_TITLE, body: REMINDER_BODY })
      }
      await forceWindowToFront()
    } catch (error) {
      console.error('Failed to fire desktop reminder', error)
    }
    return
  }

  // Browser fallback: a passive notification — there's no window to focus.
  if (!isNotificationSupported() || Notification.permission !== 'granted')
    return
  try {
    new Notification(REMINDER_TITLE, {
      body: REMINDER_BODY,
      tag: 'drinkwater-reminder', // Coalesce repeats into a single notification.
    })
  } catch {
    /* Some browsers throw if notifications are constructed without a SW; ignore. */
  }
}

interface ReminderEngineOptions {
  /** Reactive accessor for the current reminder settings. */
  settings: () => ReminderSettings
}

/**
 * Wires up the gentle drink-water reminder timer. Must be called during a
 * component's reactive setup (it uses createEffect/onCleanup). The timer is
 * (re)scheduled whenever the settings change.
 */
export function createReminderEngine(options: ReminderEngineOptions) {
  createEffect(() => {
    const { enabled, intervalMin } = options.settings()
    if (!enabled || intervalMin <= 0) return

    const intervalId = setInterval(() => {
      void fireReminder()
    }, intervalMin * 60_000)
    onCleanup(() => clearInterval(intervalId))
  })
}
