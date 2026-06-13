interface Props {
  /** The current time as an "HH:mm" string. */
  value: string
  /** Fired with the new "HH:mm" string. */
  onValueChange: (value: string) => void
  /**
   * When true, fire on every change (`input`) rather than only on commit
   * (`change`). Use for fields bound to local state in a modal.
   */
  eager?: boolean
}

/**
 * A styled "HH:mm" time picker matching the dark UI theme. `scheme-dark` keeps
 * the native clock popup and spinners dark to match the surrounding chrome.
 */
export function TimeInput(props: Props) {
  const handle = (e: { currentTarget: HTMLInputElement }) =>
    props.onValueChange(e.currentTarget.value)

  return (
    <input
      type="time"
      value={props.value}
      class="bg-[#222535] border border-white/8 rounded-lg text-[#f0f2f7] text-sm font-medium w-28 py-1.5 px-2.5 outline-none scheme-dark"
      onChange={(e) => !props.eager && handle(e)}
      onInput={(e) => props.eager && handle(e)}
    />
  )
}
