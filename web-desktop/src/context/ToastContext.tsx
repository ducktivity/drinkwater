import {
  createContext,
  createSignal,
  onCleanup,
  useContext,
  type Accessor,
  type ParentProps,
} from 'solid-js'

/** A transient, auto-dismissing notification shown in the corner of the screen. */
export interface Toast {
  id: number
  message: string
  /** `error` for failures, `info` for neutral status like being offline. */
  type: 'error' | 'info'
}

interface ToastContextValue {
  /** The toasts currently on screen, oldest first. */
  toasts: Accessor<Toast[]>
  /** Queues a toast; it auto-dismisses after a few seconds. */
  showToast: (message: string, type?: Toast['type']) => void
  /** Removes a toast immediately (e.g. when the user dismisses it). */
  dismissToast: (id: number) => void
}

const ToastContext = createContext<ToastContextValue>()

/** How long a toast stays on screen before auto-dismissing. */
const TOAST_LIFETIME_MS = 5000

/** Provides the toast queue and the actions to show/dismiss notifications. */
export function ToastProvider(props: ParentProps) {
  const [toasts, setToasts] = createSignal<Toast[]>([])

  // Monotonic id source so each toast is uniquely keyed, and a registry of the
  // pending auto-dismiss timers so we can clear them on unmount.
  let nextId = 0
  const timers = new Map<number, ReturnType<typeof setTimeout>>()

  function dismissToast(id: number) {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }

  function showToast(message: string, type: Toast['type'] = 'error') {
    const id = nextId++
    setToasts((prev) => [...prev, { id, message, type }])
    timers.set(
      id,
      setTimeout(() => dismissToast(id), TOAST_LIFETIME_MS),
    )
  }

  onCleanup(() => {
    for (const timer of timers.values()) clearTimeout(timer)
    timers.clear()
  })

  const value: ToastContextValue = { toasts, showToast, dismissToast }

  return (
    <ToastContext.Provider value={value}>
      {props.children}
    </ToastContext.Provider>
  )
}

/** Accesses the toast context. Throws if used outside its provider. */
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
