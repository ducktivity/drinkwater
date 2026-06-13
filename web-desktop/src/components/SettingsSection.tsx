import { NumberInput } from './ui/NumberInput'

interface Props {
  size: () => number
  goal: () => number
  onSizeChange: (newSize: number) => void
  onGoalChange: (newGoal: number) => void
}

/** Renders the bottle-size and daily-goal number inputs. */
export function SettingsSection(props: Props) {
  return (
    <div class="w-full flex flex-col gap-2.5">
      <div class="w-full flex items-center justify-between gap-2.5">
        <span class="text-[13px] text-[#7a7f96]">Bottle size</span>
        <NumberInput
          value={props.size()}
          step={50}
          unit="ml"
          fallback={1000}
          onValueChange={props.onSizeChange}
        />
      </div>

      <div class="w-full flex items-center justify-between gap-2.5">
        <span class="text-[13px] text-[#7a7f96]">Daily goal</span>
        <NumberInput
          value={props.goal()}
          step={100}
          unit="ml"
          fallback={2000}
          onValueChange={props.onGoalChange}
        />
      </div>
    </div>
  )
}
