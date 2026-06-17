import {
  createContext,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type Accessor,
  type ParentProps,
} from 'solid-js'
import {
  fetchCurrentUser,
  verifyCode,
  clearToken,
  getToken,
  AUTH_LOGOUT_EVENT,
  type AuthUser,
} from '../db/auth'
import { syncEngine } from '../db/sync'

/**
 * Authentication state for the app. Sign-in is optional: the app is fully usable
 * while logged out (local-only), and signing in simply switches the sync engine
 * on. This context owns the reactive `user` state and the verify/sign-out
 * actions; the raw token + network calls live in db/auth.ts.
 */
interface AuthContextValue {
  /** The signed-in account, or null when anonymous/local-only. */
  user: Accessor<AuthUser | null>
  /** Whether a session is active (sync is enabled). */
  isLoggedIn: Accessor<boolean>
  /**
   * Verifies an emailed code and, on success, signs the user in and pushes any
   * logs created while logged out. Returns an error message on failure.
   */
  verify: (email: string, code: string) => Promise<string | null>
  /** Signs out: clears the token and returns the app to local-only mode. */
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue>()

/** Provides authentication state and actions. */
export function AuthProvider(props: ParentProps) {
  const [user, setUser] = createSignal<AuthUser | null>(null)

  /**
   * Verifies an emailed code. On success we store the user and kick a sync so the
   * logs accumulated while signed out are pushed onto the account immediately.
   */
  async function verify(email: string, code: string): Promise<string | null> {
    const result = await verifyCode(email, code)
    if ('error' in result) {
      return result.error
    }
    setUser(result.user)
    syncEngine().catch(console.error)
    return null
  }

  /** Clears the session and drops back to local-only mode. */
  function signOut() {
    clearToken()
    setUser(null)
  }

  onMount(() => {
    // Restore a prior session: if a token is stored, confirm it is still valid by
    // fetching the account. An expired/revoked token yields null (api.ts clears
    // it on the 401) and we stay logged out.
    if (getToken()) {
      fetchCurrentUser()
        .then((restored) => {
          if (restored) setUser(restored)
        })
        .catch(console.error)
    }

    // The API client dispatches this when any authenticated request gets a 401,
    // so a token that expires mid-session signs the user out everywhere.
    const handleForcedLogout = () => setUser(null)
    window.addEventListener(AUTH_LOGOUT_EVENT, handleForcedLogout)
    onCleanup(() =>
      window.removeEventListener(AUTH_LOGOUT_EVENT, handleForcedLogout),
    )
  })

  const value: AuthContextValue = {
    user,
    isLoggedIn: () => user() !== null,
    verify,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
  )
}

/** Accesses the auth context. Throws if used outside its provider. */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
