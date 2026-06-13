interface Props {
  checked: boolean
  /** Accessible label, also rendered as the row text beside the switch. */
  label: string
  onChange: (checked: boolean) => void
}

/**
 * A small pill toggle switch matching the dark UI theme: a label on the left
 * and a sliding knob that moves right and turns blue when on.
 */
export function ToggleSwitch(props: Props) {
  return (
    <label class="flex items-center justify-between gap-2.5 cursor-pointer">
      <span class="text-[13px] text-[#7a7f96]">{props.label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={props.checked}
        aria-label={props.label}
        onClick={() => props.onChange(!props.checked)}
        class={`relative h-5 w-9 rounded-full transition-colors ${
          props.checked ? 'bg-sky-500' : 'bg-[#222535] border border-white/8'
        }`}
      >
        <span
          class={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform ${
            props.checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )
}
