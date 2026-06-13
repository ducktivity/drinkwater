import { Show } from 'solid-js'

interface Props {
  value: number
  /** Granularity of the native stepper; arrows are hidden via global CSS. */
  step?: number
  /** Optional unit label rendered to the right of the field (e.g. "ml", "min"). */
  unit?: string
  /** Value substituted when the field is empty or cannot be parsed. */
  fallback: number
  /** Fired with the parsed integer value. */
  onValueChange: (value: number) => void
  /**
   * When true, fire on every keystroke (`input`) rather than only on commit
   * (`change`). Use for fields bound to local state in a modal.
   */
  eager?: boolean
}

/**
 * A styled numeric input matching the dark UI theme. Parses its value to an
 * integer, falling back to `fallback` for empty/invalid input, and optionally
 * renders a unit label beside the field.
 */
export function NumberInput(props: Props) {
  const handle = (e: { currentTarget: HTMLInputElement }) =>
    props.onValueChange(parseInt(e.currentTarget.value) || props.fallback)

  return (
    <div class="flex items-center gap-1.5">
      <input
        type="number"
        value={props.value}
        step={props.step}
        class="bg-[#222535] border border-white/8 rounded-lg text-[#f0f2f7] text-sm font-medium sm:w-18 w-14 py-1.5 px-2.5 text-right outline-none"
        onChange={(e) => !props.eager && handle(e)}
        onInput={(e) => props.eager && handle(e)}
      />
      <Show when={props.unit}>
        <span class="text-[13px] text-[#7a7f96]">{props.unit}</span>
      </Show>
    </div>
  )
}
