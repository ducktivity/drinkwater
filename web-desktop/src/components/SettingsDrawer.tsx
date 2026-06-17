import { createEffect, onCleanup, type JSX } from 'solid-js'
import { useSettings } from '../context/SettingsContext'
import { useHydration } from '../context/HydrationContext'
import { AccountSection } from './AccountSection'
import { SettingsSection } from './SettingsSection'
import { ScheduleSettings } from './ScheduleSettings'
import { ReminderSettings } from './ReminderSettings'

interface Props {
  /** Whether the drawer is currently open. */
  isOpen: () => boolean
  /** Closes the drawer (backdrop click, the X button, or Escape). */
  onClose: () => void
}

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
 * and reminder settings. Pulls its own state from context so the layout stays
 * unaware of settings internals. Closes on backdrop click, the X, or Escape,
 * and locks body scroll while open.
 */
export function SettingsDrawer(props: Props) {
  const settings = useSettings()
  const hydration = useHydration()

  // While open: lock background scroll and let Escape close the drawer. The
  // effect re-runs whenever isOpen flips, cleaning up the listener/lock each time.
  createEffect(() => {
    if (!props.isOpen()) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') props.onClose()
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
      classList={{ 'pointer-events-none': !props.isOpen() }}
      aria-hidden={!props.isOpen()}
    >
      {/* Backdrop: fades in and intercepts clicks to dismiss. */}
      <div
        class="absolute inset-0 bg-black/65 transition-opacity duration-200"
        classList={{
          'opacity-100': props.isOpen(),
          'opacity-0': !props.isOpen(),
        }}
        onClick={props.onClose}
      />

      {/* Panel: slides in from the right. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        class="absolute right-0 top-0 flex h-full w-full max-w-95 flex-col border-l border-white/8 bg-[#1a1d26] shadow-2xl transition-transform duration-200 ease-out"
        classList={{
          'translate-x-0': props.isOpen(),
          'translate-x-full': !props.isOpen(),
        }}
      >
        <div class="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h2 class="text-base font-semibold text-[#f0f2f7]">Settings</h2>
          <button
            type="button"
            aria-label="Close settings"
            onClick={props.onClose}
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
            <SettingsSection
              size={settings.bottleSize}
              goal={settings.dailyGoal}
              onSizeChange={settings.setBottleSize}
              onGoalChange={settings.setDailyGoal}
            />
          </Section>

          <Section title="Hydration schedule">
            <ScheduleSettings
              schedule={settings.schedule}
              totalMl={hydration.totalMlConsumedToday}
              now={settings.now}
              onUpdateCheckpoint={settings.updateCheckpoint}
              onRemoveCheckpoint={settings.removeCheckpoint}
              onAddCheckpoint={settings.addCheckpoint}
            />
          </Section>

          <Section title="Reminders">
            <ReminderSettings
              settings={settings.reminder}
              onChange={settings.changeReminder}
            />
          </Section>
        </div>
      </aside>
    </div>
  )
}
