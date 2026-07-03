import { onMount } from 'solid-js'
import { AppProvider } from './context/AppProvider'
import { AppLayout } from './components/layout/AppLayout'
import { AppDialogs } from './components/dialogs/AppDialogs'
import { ToastContainer } from './components/feedback/ToastContainer'
import { useToast } from './context/ToastContext'
import { checkForUpdates } from './updater'

/**
 * Kicks off the desktop auto-update check once on startup. Renders nothing; it lives inside the providers purely so the updater can raise a toast. No-op on the web (see updater.ts).
 */
function UpdaterGate() {
  const { showToast } = useToast()
  onMount(() => {
    void checkForUpdates(showToast)
  })
  return null
}

/**
 * App root: wraps the UI in the composed context provider (configurable settings, hydration core, history view, and dialog overlays) and renders the layout and dialogs.
 */
export default function App() {
  return (
    <AppProvider>
      <UpdaterGate />
      <AppLayout />
      <AppDialogs />
      <ToastContainer />
    </AppProvider>
  )
}
