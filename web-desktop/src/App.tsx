import { AppProvider } from './context/AppProvider'
import { AppLayout } from './components/layout/AppLayout'
import { AppDialogs } from './components/dialogs/AppDialogs'
import { ToastContainer } from './components/feedback/ToastContainer'

/**
 * App root: wraps the UI in the composed context provider (configurable
 * settings, hydration core, history view, and dialog overlays) and renders the
 * layout and dialogs.
 */
export default function App() {
  return (
    <AppProvider>
      <AppLayout />
      <AppDialogs />
      <ToastContainer />
    </AppProvider>
  )
}
