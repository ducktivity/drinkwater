import { Show } from 'solid-js'
import {
  isNotificationSupported,
  type ReminderSettings as ReminderSettingsValue,
} from '../reminder'
import { NumberInput } from './ui/NumberInput'
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
          <NumberInput
            value={props.settings().intervalMin}
            step={5}
            unit="min"
            fallback={30}
            onValueChange={(intervalMin) => props.onChange({ intervalMin })}
          />
        </div>
      </Show>
    </div>
  )
}
