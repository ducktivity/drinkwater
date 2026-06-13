/** Returns today's date as a zero-padded ISO string (YYYY-MM-DD) in local time. */
export function getTodayKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Converts a YYYY-MM-DD date key into a human-readable short date (e.g. "5 Jun"). */
export function formatDay(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

/** Formats an ISO timestamp into a human-readable 12-hour local time (e.g. "2:30 PM"). */
export function formatTime(isoTimestamp: string) {
  return new Date(isoTimestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** Converts an ISO timestamp into a local "HH:mm" string for an <input type="time">. */
export function toTimeInputValue(isoTimestamp: string) {
  const date = new Date(isoTimestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * Returns a new ISO timestamp that keeps the original date but applies the
 * given local "HH:mm" time-of-day. Seconds and milliseconds are zeroed.
 */
export function withTimeOfDay(isoTimestamp: string, timeValue: string) {
  const [hours, minutes] = timeValue.split(':').map(Number)
  const date = new Date(isoTimestamp)
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

/** Builds a Date at the given local "HH:mm" time-of-day, on the same calendar day as `reference`. */
export function timeValueToDate(timeValue: string, reference: Date) {
  const [hours, minutes] = timeValue.split(':').map(Number)
  const date = new Date(reference)
  date.setHours(hours, minutes, 0, 0)
  return date
}

/** Formats an "HH:mm" time-of-day string into 12-hour local time (e.g. "9:00 AM"). */
export function formatClockTime(timeValue: string) {
  const [hours, minutes] = timeValue.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** Formats a millilitre value — displays as litres when ≥ 1000 ml (e.g. "1.5 L"), otherwise as "750 ml". */
export function formatMl(milliliters: number) {
  return milliliters >= 1000
    ? (milliliters / 1000).toFixed(1) + ' L'
    : milliliters + ' ml'
}

/** Constrains a value to the inclusive range [min, max]. */
export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
