import { createEffect, onCleanup, type JSX } from 'solid-js'
import { useOverlay } from '../../context/OverlayContext'
import { AccountSection } from './AccountSection'
import { GoalSettingsSection } from './GoalSettingsSection'
import { ScheduleSettings } from './ScheduleSettings'
import { ReminderSettings } from './ReminderSettings'

/** A labelled group of related settings within the drawer. */
function Section(props: { title: string; children: JSX.Element }) {
  return (
    <section class="flex flex-col gap-3">
      <h3 class="text-[11px] font-semibold uppercase tracking-wider text-[#7a7f96]">
        {props.title}
      </h3>
      {props.children}
    </section>
  )
}

/**
 * A right-anchored slide-over panel holding everything that used to clutter the
 * main card: the account row, bottle/goal preferences, the hydration schedule,
 * and reminder settings. Reads its open state from the overlay context and each
 * section pulls its own state from context, so the drawer only arranges them.
 * Closes on backdrop click, the X, or Escape, and locks body scroll while open.
 */
export function SettingsDrawer() {
  const overlay = useOverlay()

  // While open: lock background scroll and let Escape close the drawer. The
  // effect re-runs whenever isSettingsOpen flips, cleaning up the listener/lock each time.
  createEffect(() => {
    if (!overlay.isSettingsOpen()) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') overlay.closeSettings()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    onCleanup(() => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    })
  })

  return (
    <div
      class="fixed inset-0 z-50"
      classList={{ 'pointer-events-none': !overlay.isSettingsOpen() }}
      aria-hidden={!overlay.isSettingsOpen()}
    >
      {/* Backdrop: fades in and intercepts clicks to dismiss. */}
      <div
        class="absolute inset-0 bg-black/65 transition-opacity duration-200"
        classList={{
          'opacity-100': overlay.isSettingsOpen(),
          'opacity-0': !overlay.isSettingsOpen(),
        }}
        onClick={overlay.closeSettings}
      />

      {/* Panel: slides in from the right. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        class="absolute right-0 top-0 flex size-full max-w-95 flex-col border-l border-white/8 bg-[#1a1d26] shadow-2xl transition-transform duration-200 ease-out"
        classList={{
          'translate-x-0': overlay.isSettingsOpen(),
          'translate-x-full': !overlay.isSettingsOpen(),
        }}
      >
        <div class="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h2 class="text-base font-semibold text-[#f0f2f7]">Settings</h2>
          <button
            type="button"
            aria-label="Close settings"
            onClick={overlay.closeSettings}
            class="text-[#7a7f96] hover:text-[#f0f2f7] cursor-pointer p-1 leading-none transition-colors"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div class="flex flex-1 flex-col gap-7 overflow-y-auto px-5 py-6">
          <Section title="Account">
            <AccountSection />
          </Section>

          <Section title="Preferences">
            <GoalSettingsSection />
          </Section>

          <Section title="Hydration schedule">
            <ScheduleSettings />
          </Section>

          <Section title="Reminders">
            <ReminderSettings />
          </Section>
        </div>
      </aside>
    </div>
  )
}
