import { type ParentProps } from 'solid-js'
import { ToastProvider } from './ToastContext'
import { AuthProvider } from './AuthContext'
import { SettingsProvider } from './SettingsContext'
import { HydrationProvider } from './HydrationContext'
import { HistoryProvider } from './HistoryContext'
import { OverlayProvider } from './OverlayContext'

/**
 * Composes the app's context providers into a single wrapper. The nesting order
 * matters: each provider may consume the ones above it (Toast is outermost so
 * any provider can raise notifications; Auth sits high so its sign-in can drive
 * sync; Hydration reads Settings, History reads Hydration, Overlay reads Settings
 * and Hydration), so they must stay in this order.
 */
export function AppProvider(props: ParentProps) {
  return (
    <ToastProvider>
      <AuthProvider>
        <SettingsProvider>
          <HydrationProvider>
            <HistoryProvider>
              <OverlayProvider>{props.children}</OverlayProvider>
            </HistoryProvider>
          </HydrationProvider>
        </SettingsProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
