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

/** Whether the Notification API is available in this browser. */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/**
 * Ensures we have permission to show notifications, prompting the user once if
 * the permission has not yet been decided. Resolves to true when granted.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

/**
 * Shows a browser notification when permission has been granted. Silently does
 * nothing otherwise, so callers can fire reminders without guarding every call.
 */
function showNotification(title: string, body: string) {
  if (!isNotificationSupported() || Notification.permission !== 'granted')
    return
  try {
    new Notification(title, {
      body,
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
      showNotification(
        'Time to hydrate 💧',
        'Take a sip of water to stay on track.',
      )
    }, intervalMin * 60_000)
    onCleanup(() => clearInterval(intervalId))
  })
}
