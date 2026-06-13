import { Show } from 'solid-js'
import {
  isNotificationSupported,
  type ReminderSettings as ReminderSettingsValue,
} from '../reminder'
import { ToggleSwitch } from './ui/ToggleSwitch'

interface Props {
  settings: () => ReminderSettingsValue
  /** Applies a partial change to the reminder settings. */
  onChange: (changes: Partial<ReminderSettingsValue>) => void
}

/**
 * Settings for the gentle drink-water reminder: a toggle plus the interval
 * between nudges. The interval input is only shown while the reminder is on.
 */
export function ReminderSettings(props: Props) {
  return (
    <div class="w-full flex flex-col gap-2.5">
      <Show when={!isNotificationSupported()}>
        <p class="text-[11px] text-[#7a7f96]">
          Notifications aren't supported in this browser, so reminders won't be
          shown.
        </p>
      </Show>

      <ToggleSwitch
        checked={props.settings().enabled}
        label="Remind me to drink"
        onChange={(enabled) => props.onChange({ enabled })}
      />

      <Show when={props.settings().enabled}>
        <div class="flex items-center justify-between gap-2.5 pl-3">
          <span class="text-[13px] text-[#7a7f96]">Every</span>
          <div class="flex items-center gap-1.5">
            <input
              type="number"
              value={props.settings().intervalMin}
              min="1"
              max="240"
              step="5"
              class="bg-[#222535] border border-white/8 rounded-lg text-[#f0f2f7] text-sm font-medium w-18 py-1.5 px-2.5 text-right outline-none"
              onChange={(e) =>
                props.onChange({
                  intervalMin: parseInt(e.currentTarget.value) || 60,
                })
              }
            />
            <span class="text-[13px] text-[#7a7f96]">min</span>
          </div>
        </div>
      </Show>
    </div>
  )
}
