/**
 * Comparator that orders log entries most-recent-first by their actual instant.
 * Compares parsed timestamps rather than the raw ISO strings, so entries stay
 * correctly ordered even when timestamps arrive in mixed formats — e.g. the
 * backend's timezone-offset form ("…+08:00") alongside the client's UTC "Z"
 * form. Plain string/locale comparison of those mixed forms is unreliable.
 */
export function compareLoggedAtDesc(
  a: { logged_at: string },
  b: { logged_at: string },
) {
  return new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
}

/** Returns today's date as a zero-padded ISO string (YYYY-MM-DD) in local time. */
export function getTodayKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Formats a Date into a zero-padded local YYYY-MM-DD key. */
export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Returns the date key `dayDelta` days away from the given YYYY-MM-DD key. */
export function shiftDateKey(dateKey: string, dayDelta: number) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return toDateKey(new Date(year, month - 1, day + dayDelta))
}

/**
 * Builds an ISO timestamp for a local "HH:mm" time-of-day on the calendar day
 * named by a YYYY-MM-DD key. Used when adding a log to a specific (past) day.
 */
export function isoFromDateAndTime(dateKey: string, timeValue: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const [hours, minutes] = timeValue.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString()
}

/** Formats a YYYY-MM-DD key into a human-readable long date (e.g. "Mon, 5 June"). */
export function formatFullDay(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })
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
