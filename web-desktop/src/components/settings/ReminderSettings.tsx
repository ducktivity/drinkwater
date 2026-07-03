import { Show } from 'solid-js'
import { isNotificationSupported } from '../../reminder'
import { useSettings } from '../../context/SettingsContext'
import { NumberInput } from '../ui/NumberInput'
import { ToggleSwitch } from '../ui/ToggleSwitch'

/**
 * Settings for the gentle drink-water reminder: a toggle plus the interval between nudges. The interval input is only shown while the reminder is on. Reads and updates the reminder settings through the settings context.
 */
export function ReminderSettings() {
  const settings = useSettings()

  return (
    <div class="w-full flex flex-col gap-2.5">
      <Show when={!isNotificationSupported()}>
        <p class="text-[11px] text-[#7a7f96]">
          Notifications aren't supported in this browser, so reminders won't be
          shown.
        </p>
      </Show>

      <ToggleSwitch
        checked={settings.reminder().enabled}
        label="Remind me to drink"
        onChange={(enabled) => settings.changeReminder({ enabled })}
      />

      <Show when={settings.reminder().enabled}>
        <div class="flex items-center justify-between gap-2.5 pl-3">
          <span class="text-[13px] text-[#7a7f96]">Every</span>
          <NumberInput
            value={settings.reminder().intervalMin}
            step={5}
            unit="min"
            fallback={30}
            onValueChange={(intervalMin) =>
              settings.changeReminder({ intervalMin })
            }
          />
        </div>
      </Show>
    </div>
  )
}
