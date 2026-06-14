import { type ParentProps } from 'solid-js'
import { SettingsProvider } from './SettingsContext'
import { HydrationProvider } from './HydrationContext'
import { HistoryProvider } from './HistoryContext'
import { OverlayProvider } from './OverlayContext'

/**
 * Composes the app's context providers into a single wrapper. The nesting order
 * matters: each provider may consume the ones above it (Hydration reads
 * Settings, History reads Hydration, Overlay reads all three), so they must
 * stay in this order.
 */
export function AppProvider(props: ParentProps) {
  return (
    <SettingsProvider>
      <HydrationProvider>
        <HistoryProvider>
          <OverlayProvider>{props.children}</OverlayProvider>
        </HistoryProvider>
      </HydrationProvider>
    </SettingsProvider>
  )
}
