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
