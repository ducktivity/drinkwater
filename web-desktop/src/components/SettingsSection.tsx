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
        <div class="flex items-center gap-1.5">
          <input
            type="number"
            value={props.size()}
            min="100"
            max="3000"
            step="50"
            class="bg-[#222535] border border-white/8 rounded-lg text-[#f0f2f7] text-sm font-medium w-18 py-1.5 px-2.5 text-right outline-none"
            onChange={(e) =>
              props.onSizeChange(parseInt(e.currentTarget.value) || 1000)
            }
          />
          <span class="text-[13px] text-[#7a7f96]">ml</span>
        </div>
      </div>

      <div class="w-full flex items-center justify-between gap-2.5">
        <span class="text-[13px] text-[#7a7f96]">Daily goal</span>
        <div class="flex items-center gap-1.5">
          <input
            type="number"
            value={props.goal()}
            min="500"
            max="8000"
            step="100"
            class="bg-[#222535] border border-white/8 rounded-lg text-[#f0f2f7] text-sm font-medium w-18 py-1.5 px-2.5 text-right outline-none"
            onChange={(e) =>
              props.onGoalChange(parseInt(e.currentTarget.value) || 2000)
            }
          />
          <span class="text-[13px] text-[#7a7f96]">ml</span>
        </div>
      </div>
    </div>
  )
}
