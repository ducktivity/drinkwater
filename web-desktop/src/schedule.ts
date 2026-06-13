import { timeValueToDate } from './utils'

/**
 * A single time-based hydration checkpoint: the user is expected to have drunk
 * at least `targetMl` (cumulative, since the start of the day) by `time`.
 */
export interface ScheduleCheckpoint {
  /** Stable unique id used for list rendering and inline edits. */
  id: string
  /** Local time-of-day deadline as a "HH:mm" 24-hour string. */
  time: string
  /** Cumulative millilitres the user should have drunk by this time. */
  targetMl: number
}

/** A checkpoint's status relative to the current time and amount drunk. */
export type CheckpointState =
  // Target already reached.
  | 'met'
  // Deadline has passed but the target was not reached — the user is behind.
  | 'missed'
  // Deadline is still in the future and the target is not yet reached.
  | 'upcoming'

/** A checkpoint enriched with its evaluated state and remaining amount. */
export interface CheckpointStatus extends ScheduleCheckpoint {
  state: CheckpointState
  /** Millilitres still needed to reach this checkpoint's target (0 once met). */
  remainingMl: number
}

/**
 * Default schedule spreading a 2 L day across four deadlines, mirroring the
 * product example (morning through evening). Ids are stable strings so the
 * default is deterministic.
 */
export const DEFAULT_SCHEDULE: ScheduleCheckpoint[] = [
  { id: 'cp-0900', time: '09:00', targetMl: 500 },
  { id: 'cp-1200', time: '12:00', targetMl: 1000 },
  { id: 'cp-1500', time: '15:00', targetMl: 1500 },
  { id: 'cp-1900', time: '19:00', targetMl: 2000 },
]

/**
 * Sorts the schedule chronologically and tags each checkpoint with its current
 * state and the amount still needed, given how much has been drunk today and
 * the current time. Pure — callers pass `now` so the result is reactive.
 */
export function evaluateSchedule(
  schedule: ScheduleCheckpoint[],
  totalMl: number,
  now: Date,
): CheckpointStatus[] {
  return [...schedule]
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((checkpoint) => {
      const remainingMl = Math.max(0, checkpoint.targetMl - totalMl)
      const isMet = remainingMl === 0
      const isPastDeadline =
        now.getTime() >= timeValueToDate(checkpoint.time, now).getTime()
      const state: CheckpointState = isMet
        ? 'met'
        : isPastDeadline
          ? 'missed'
          : 'upcoming'
      return { ...checkpoint, state, remainingMl }
    })
}

/**
 * Returns the next checkpoint the user is working toward: the earliest
 * not-yet-met checkpoint whose deadline has not passed. Returns null when every
 * upcoming checkpoint is already satisfied.
 */
export function getNextCheckpoint(
  statuses: CheckpointStatus[],
): CheckpointStatus | null {
  return statuses.find((status) => status.state === 'upcoming') ?? null
}

/**
 * Returns the most pressing missed checkpoint (the latest passed deadline the
 * user has fallen behind on), or null when the user is on track. The latest
 * missed checkpoint has the highest cumulative target, so it best summarises how
 * far behind the user is.
 */
export function getMostRecentMissed(
  statuses: CheckpointStatus[],
): CheckpointStatus | null {
  const missed = statuses.filter((status) => status.state === 'missed')
  return missed.length > 0 ? missed[missed.length - 1] : null
}
