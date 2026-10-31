import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { setRefusedWriteIdentity } from '../lib/refusedWrite'
import { installErrorShownSink } from '../lib/errorShownSink'
import { setNavClickViewer } from '../lib/navClickViewer'
import { AUTH_GATE_RECHECK_MS, ROLE_READ_RETRY_MS, appHealthHoldsGate, shouldRetryRoleRead } from '../lib/appHealth'
import { useKeptReadsClearedOnAccountChange } from './useKeptReadsCleared'
import { useOutboxClearedOnAccountChange } from './useOutboxCleared'

// Session refresh: refresh when less than this time remains (tuned for 10h JWT expiry)
const REFRESH_WINDOW_MS = 30 * 60 * 1000 // 30 minutes
// Expiry warning: show when less than this time remains
const WARNING_THRESHOLD_MS = 15 * 60 * 1000 // 15 minutes

export type UserRole =
  | 'dev'
  | 'master_technician'
  | 'assistant'
  | 'subcontractor'
  | 'helpers'
  | 'estimator'
  | 'primary'
  | 'superintendent'
  | 'controller'

interface UseAuthReturn {
  user: User | null
  role: UserRole | null
  /** Display name from public.users.name for the current session user. */
  profileName: string | null
  /** True only when role is estimator and users.estimator_prospects_access is set. */
  estimatorProspectsAccess: boolean
  /** Per-user gate for the Prospects Team hiring board (users.team_prospects_access). */
  teamProspectsAccess: boolean
  /** Training mode (users.read_only): browsing works, all writes are blocked by RLS. */
  readOnly: boolean
  loading: boolean
  checkSession: () => Promise<boolean>
  sessionExpiresAt: number | null
}

const AuthContext = createContext<UseAuthReturn | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [profileName, setProfileName] = useState<string | null>(null)
  const [estimatorProspectsAccess, setEstimatorProspectsAccess] = useState(false)
  const [teamProspectsAccess, setTeamProspectsAccess] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  /**
   * False while a signed-in user's role row is still in flight (v2.1485). The
   * exported `loading` stays true until the role settles, so the app never
   * renders a signed-in frame with role=null — that window made the dashboard
   * flash the primary-role pin set and a section-less layout right after
   * sign-in, then reflow when the real role landed a round-trip later.
   */
  const [roleResolved, setRoleResolved] = useState(false)
  // Sign-out and an account switch drop every kept read on the device (#183 PR 2, v2.6031).
  useKeptReadsClearedOnAccountChange(user?.id, !loading)
  // So does every queued press (punch list #163 PR 2); a sign-in reads this person's back.
  useOutboxClearedOnAccountChange(user?.id, !loading)
  // Refused-write beacon (v2.3058): tell the guard who was refused. Cleared on sign-out. The error-shown
  // sink (punch list #187 PR 2) is installed the same way, so every error line a person sees is one row,
  // and so is the press viewer (v2.5904), so a Call button or a Pipeline row records a press as them.
  useEffect(() => {
    setRefusedWriteIdentity(user?.id ?? null, role)
    installErrorShownSink(user?.id ?? null, role)
    setNavClickViewer(user?.id ?? null, role)
  }, [user?.id, role])
  /** User id whose role we already resolved — token refreshes for the same user must not re-raise the gate. */
  const roleResolvedForUserIdRef = useRef<string | null>(null)
  /** Cancels the role read in flight (its watchdog and its retries) when a newer session event supersedes it. */
  const cancelRoleReadRef = useRef<(() => void) | null>(null)
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null)
  const warningShownRef = useRef(false)
  const lastActivityRef = useRef(Date.now())
  const refreshTimeoutRef = useRef<NodeJS.Timeout>()
  const sessionExpiresAtRef = useRef<number | null>(null)
  sessionExpiresAtRef.current = sessionExpiresAt

  // Check if session is valid
  const checkSession = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error || !session) {
      await supabase.auth.signOut()
      setUser(null)
      setRole(null)
      setProfileName(null)
      setEstimatorProspectsAccess(false)
      setSessionExpiresAt(null)
      return false
    }

    const expiresAtMs = session.expires_at ? session.expires_at * 1000 : null
    setSessionExpiresAt(expiresAtMs)

    // Proactively refresh when session has less than REFRESH_WINDOW_MS left (tab visible)
    if (expiresAtMs && document.visibilityState === 'visible') {
      const timeUntilExpiry = expiresAtMs - Date.now()
      if (timeUntilExpiry > 0 && timeUntilExpiry < REFRESH_WINDOW_MS) {
        const { data, error: refreshError } = await supabase.auth.refreshSession()
        if (!refreshError && data.session) {
          setSessionExpiresAt(data.session.expires_at ? data.session.expires_at * 1000 : null)
          warningShownRef.current = false
        }
      }
    }

    return true
  }, [])

  // Handle user activity and refresh session if needed (reads from ref to avoid effect re-runs)
  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    const expiresAt = sessionExpiresAtRef.current
    if (!expiresAt) return
    
    const timeUntilExpiry = expiresAt - Date.now()
    if (timeUntilExpiry <= 0 || timeUntilExpiry >= REFRESH_WINDOW_MS) return
    
    if (refreshTimeoutRef.current) return
    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = undefined
    }, 10 * 1000)
    
    supabase.auth.refreshSession().then(({ data, error }) => {
      if (!error && data.session) {
        setSessionExpiresAt(data.session.expires_at ? data.session.expires_at * 1000 : null)
        warningShownRef.current = false
      }
    })
  }, [])

  function applySession(session: { user: User; expires_at?: number } | null) {
    setUser(session?.user ?? null)
    setSessionExpiresAt(session?.expires_at ? session.expires_at * 1000 : null)
    if (session?.user?.id) {
      const userId = session.user.id
      // Raise the role gate only for a user we haven't resolved yet — auth
      // events for the same user (token refresh, tab focus) refetch in the
      // background without flashing the loading screen mid-session.
      if (roleResolvedForUserIdRef.current !== userId) {
        setRoleResolved(false)
        // Another person's role and name never stand for this one, not even while a read with no signal is read
        // again (v2.6198): only the same person keeps them through a failed read.
        setRole(null)
        setProfileName(null)
        setEstimatorProspectsAccess(false)
        setTeamProspectsAccess(false)
        setReadOnly(false)
      }
      const settleRole = () => {
        roleResolvedForUserIdRef.current = userId
        setRoleResolved(true)
      }
      cancelRoleReadRef.current?.()
      let cancelled = false
      let roleGateTimer: ReturnType<typeof setTimeout> | undefined
      let retryTimer: ReturnType<typeof setTimeout> | undefined
      cancelRoleReadRef.current = () => {
        cancelled = true
        clearTimeout(roleGateTimer)
        clearTimeout(retryTimer)
      }
      // Watchdog (mirrors the v2.1051 getSession watchdog): a hung role query
      // must not hold the whole app on "Loading…" — give up gating after 4s
      // and let the null-role experience render until the query resolves.
      // Except in a freeze (#183 PR 1, v2.6009): while the app-health kernel
      // says slow or unreachable the gate holds, looking again every 2 s, and
      // the gate's screen says why — a frozen database is not a missing role.
      const armRoleGate = (ms: number) => {
        roleGateTimer = setTimeout(() => {
          if (cancelled) return
          if (appHealthHoldsGate()) {
            armRoleGate(AUTH_GATE_RECHECK_MS)
            return
          }
          settleRole()
        }, ms)
      }
      armRoleGate(4000)
      const readRole = () => {
        supabase
          .from('users')
          .select('name, role, estimator_prospects_access, team_prospects_access, read_only')
          .eq('id', userId)
          .single()
          .then(({ data, error: rowError, status }) => {
            if (cancelled) return
            // A read the freeze failed (its statement timeout, or any refusal while the app is
            // slow) is read again in 5 s rather than settling a null role for the whole session.
            // So is one that never reached the server: an auth event with no signal keeps the role
            // and the name already read (punch list #163's live test, v2.6198).
            if ((rowError || !data) && shouldRetryRoleRead(rowError ? { code: rowError.code, message: rowError.message, status } : null)) {
              retryTimer = setTimeout(readRole, ROLE_READ_RETRY_MS)
              return
            }
            clearTimeout(roleGateTimer)
            settleRole()
            if (rowError || !data) {
              setRole(null)
              setEstimatorProspectsAccess(false)
              setTeamProspectsAccess(false)
              setReadOnly(false)
              setProfileName(null)
              return
            }
            const row = data as { name: string; role: UserRole; estimator_prospects_access?: boolean | null; team_prospects_access?: boolean | null; read_only?: boolean | null }
            const trimmed = row.name?.trim() ?? ''
            setProfileName(trimmed.length > 0 ? trimmed : null)
            const r = row?.role ?? null
            setRole(r)
            setEstimatorProspectsAccess(r === 'estimator' && !!row?.estimator_prospects_access)
            setTeamProspectsAccess(!!row?.team_prospects_access)
            setReadOnly(!!row?.read_only)
          })
      }
      readRole()
    } else {
      cancelRoleReadRef.current?.()
      cancelRoleReadRef.current = null
      setRole(null)
      setProfileName(null)
      setEstimatorProspectsAccess(false)
      setTeamProspectsAccess(false)
      setReadOnly(false)
      // Signed out: nothing to resolve — never hold the gate.
      roleResolvedForUserIdRef.current = null
      setRoleResolved(true)
    }
  }

  useEffect(() => {
    // Initial session check — with a watchdog (v2.1051). getSession() can hang
    // forever when the DB/auth is frozen (both 2026-07-28 outages) or when the
    // auth client's internal lock is wedged after a mid-refresh kill on mobile.
    // Without the watchdog the whole app sits on the black "Loading…" screen.
    // On timeout we render signed-out (the sign-in screen); if the check later
    // resolves with a session, applySession below still signs the user in.
    // In a freeze the watchdog waits (#183 PR 1, v2.6009): while the app-health
    // kernel says slow or unreachable it looks again every 2 s instead of
    // giving up, so a frozen database no longer lands a cold open on sign-in;
    // the gate's screen reads "The app is slow right now. Keep this open."
    // A wedged auth lock makes no request, so the kernel stays fine and the
    // watchdog gives up at 8 s as before.
    let gateSettled = false
    let gateTimer: ReturnType<typeof setTimeout> | undefined
    const armGate = (ms: number) => {
      gateTimer = setTimeout(() => {
        if (gateSettled) return
        if (appHealthHoldsGate()) {
          armGate(AUTH_GATE_RECHECK_MS)
          return
        }
        gateSettled = true
        setUser(null)
        setRole(null)
        setProfileName(null)
        setSessionExpiresAt(null)
        setLoading(false)
      }, ms)
    }
    armGate(8000)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      gateSettled = true
      clearTimeout(gateTimer)
      if (error && error.message?.includes('Refresh Token')) {
        void supabase.auth.signOut()
      }
      applySession(session)
      setLoading(false)
    }).catch(() => {
      gateSettled = true
      clearTimeout(gateTimer)
      setUser(null)
      setRole(null)
      setProfileName(null)
      setSessionExpiresAt(null)
      setLoading(false)
    })

    // Listen for auth state changes - fetch role when session is set (fixes direct sign-in role timing)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session)
    })

    // Track user activity to refresh session
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll']
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    // Periodic session validation (every 5 minutes when tab is visible)
    const sessionCheckInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void checkSession()
      }
    }, 5 * 60 * 1000)

    // Check session expiry every minute (reads from ref)
    const expiryCheckInterval = setInterval(() => {
      const expiresAt = sessionExpiresAtRef.current
      if (!expiresAt) return

      const timeUntilExpiry = expiresAt - Date.now()
      
      // Session expired - sign out
      if (timeUntilExpiry <= 0) {
        void supabase.auth.signOut()
        return
      }

      // Check for recent activity (within last 2 minutes)
      const timeSinceActivity = Date.now() - lastActivityRef.current
      const hasRecentActivity = timeSinceActivity < 2 * 60 * 1000

      // If there's recent activity and session is expiring soon, it should have been refreshed
      // Only show warning if no recent activity
      if (timeUntilExpiry < WARNING_THRESHOLD_MS && !warningShownRef.current && !hasRecentActivity) {
        warningShownRef.current = true
        // Dispatch custom event for warning
        window.dispatchEvent(new CustomEvent('session-expiring', {
          detail: { minutesRemaining: Math.ceil(timeUntilExpiry / 60000) }
        }))
      }

      // Reset warning flag if session refreshed
      if (timeUntilExpiry > WARNING_THRESHOLD_MS) {
        warningShownRef.current = false
      }
    }, 60 * 1000)

    return () => {
      gateSettled = true
      clearTimeout(gateTimer)
      cancelRoleReadRef.current?.()
      subscription.unsubscribe()
      clearInterval(sessionCheckInterval)
      clearInterval(expiryCheckInterval)
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [checkSession])

  const value: UseAuthReturn = {
    user,
    role,
    profileName,
    estimatorProspectsAccess,
    teamProspectsAccess,
    readOnly,
    // "Auth not ready" = session pending, OR a signed-in user whose role row
    // is still in flight (v2.1485) — consumers must never see user && role=null
    // during the initial round-trip.
    loading: loading || (user != null && !roleResolved),
    checkSession,
    sessionExpiresAt,
  }

  return createElement(AuthContext.Provider, { value }, children)
}

/** The auth, or null outside an AuthProvider (v2.4783) — for a line that should stay silent in a render smoke rather than throw. */
export function useOptionalAuth(): UseAuthReturn | null {
  return useContext(AuthContext)
}

export function useAuth(): UseAuthReturn {
  const ctx = useContext(AuthContext)
  if (ctx == null) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
