import { createMemo, For } from 'solid-js'
import {
  evaluateSchedule,
  type CheckpointState,
  type CheckpointStatus,
  type ScheduleCheckpoint,
} from '../schedule'
import { NumberInput } from './ui/NumberInput'
import { TimeInput } from './ui/TimeInput'

interface Props {
  schedule: () => ScheduleCheckpoint[]
  totalMl: () => number
  now: () => Date
  /** Applies a partial change to one checkpoint (fine-grained, in place). */
  onUpdateCheckpoint: (id: string, changes: Partial<ScheduleCheckpoint>) => void
  onRemoveCheckpoint: (id: string) => void
  onAddCheckpoint: () => void
}

/** Text colour for a checkpoint's status dot/label by state. */
const STATE_STYLES: Record<CheckpointState, string> = {
  met: 'text-emerald-400',
  missed: 'text-red-400',
  upcoming: 'text-[#7a7f96]',
}

/** Short human label for a checkpoint state, shown beside each row. */
const STATE_LABELS: Record<CheckpointState, string> = {
  met: '✓ met',
  missed: '✗ missed',
  upcoming: 'upcoming',
}

/**
 * Editable list of timed hydration checkpoints. Each row sets a deadline time
 * and the cumulative millilitres expected by then; rows can be added or removed.
 * A live status badge shows whether each checkpoint is met, missed, or upcoming.
 */
export function ScheduleSettings(props: Props) {
  // Status of every checkpoint, looked up by id. We render rows in the
  // schedule's stable insertion order (not sorted by time) so that editing a
  // checkpoint's time never reorders the list and steals focus from the input;
  // the badge for each row is pulled from this map instead.
  const statusById = createMemo(() => {
    const map = new Map<string, CheckpointStatus>()
    for (const status of evaluateSchedule(
      props.schedule(),
      props.totalMl(),
      props.now(),
    )) {
      map.set(status.id, status)
    }
    return map
  })

  return (
    <div class="w-full flex flex-col gap-2.5">
      <span class="text-[13px] text-[#7a7f96]">Hydration schedule</span>

      <For each={props.schedule()}>
        {(checkpoint) => {
          const status = () => statusById().get(checkpoint.id)
          return (
            <div class="flex items-center gap-2">
              <TimeInput
                value={checkpoint.time}
                onValueChange={(time) =>
                  props.onUpdateCheckpoint(checkpoint.id, { time })
                }
              />
              <NumberInput
                value={checkpoint.targetMl}
                step={100}
                unit="ml"
                fallback={0}
                onValueChange={(targetMl) =>
                  props.onUpdateCheckpoint(checkpoint.id, { targetMl })
                }
              />
              <span
                class={`text-[11px] font-semibold ml-auto ${STATE_STYLES[status()?.state ?? 'upcoming']}`}
              >
                {STATE_LABELS[status()?.state ?? 'upcoming']}
              </span>
              <button
                type="button"
                aria-label="Remove checkpoint"
                class="text-[#7a7f96] hover:text-red-400 cursor-pointer p-0.5 leading-none transition-colors"
                onClick={() => props.onRemoveCheckpoint(checkpoint.id)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </button>
            </div>
          )
        }}
      </For>

      <button
        type="button"
        class="w-full py-2 rounded-[10px] border border-white/8 bg-[#222535] text-[13px] font-medium text-[#7a7f96] cursor-pointer hover:text-[#f0f2f7] transition-colors"
        onClick={props.onAddCheckpoint}
      >
        + Add checkpoint
      </button>
    </div>
  )
}
