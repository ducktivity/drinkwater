import { useSettings } from '../../context/SettingsContext'
import { NumberInput } from '../ui/NumberInput'

/** Renders the bottle-size and daily-goal number inputs, bound to settings context. */
export function SettingsSection() {
  const settings = useSettings()

  return (
    <div class="w-full flex flex-col gap-2.5">
      <div class="w-full flex items-center justify-between gap-2.5">
        <span class="text-[13px] text-[#7a7f96]">Bottle size</span>
        <NumberInput
          value={settings.bottleSize()}
          step={50}
          unit="ml"
          fallback={1000}
          onValueChange={settings.setBottleSize}
        />
      </div>

      <div class="w-full flex items-center justify-between gap-2.5">
        <span class="text-[13px] text-[#7a7f96]">Daily goal</span>
        <NumberInput
          value={settings.dailyGoal()}
          step={100}
          unit="ml"
          fallback={2000}
          onValueChange={settings.setDailyGoal}
        />
      </div>
    </div>
  )
}
