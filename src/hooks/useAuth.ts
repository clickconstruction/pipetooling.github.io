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

// Session refresh: refresh when less than this time remains (tuned for 10h JWT expiry)
const REFRESH_WINDOW_MS = 30 * 60 * 1000 // 30 minutes
// Expiry warning: show when less than this time remains
const WARNING_THRESHOLD_MS = 15 * 60 * 1000 // 15 minutes

export type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'estimator' | 'primary' | 'superintendent'

interface UseAuthReturn {
  user: User | null
  role: UserRole | null
  /** Display name from public.users.name for the current session user. */
  profileName: string | null
  /** True only when role is estimator and users.estimator_prospects_access is set. */
  estimatorProspectsAccess: boolean
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
  const [loading, setLoading] = useState(true)
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
      supabase
        .from('users')
        .select('name, role, estimator_prospects_access')
        .eq('id', session.user.id)
        .single()
        .then(({ data, error: rowError }) => {
          if (rowError || !data) {
            setRole(null)
            setEstimatorProspectsAccess(false)
            setProfileName(null)
            return
          }
          const row = data as { name: string; role: UserRole; estimator_prospects_access?: boolean | null }
          const trimmed = row.name?.trim() ?? ''
          setProfileName(trimmed.length > 0 ? trimmed : null)
          const r = row?.role ?? null
          setRole(r)
          setEstimatorProspectsAccess(r === 'estimator' && !!row?.estimator_prospects_access)
        })
    } else {
      setRole(null)
      setProfileName(null)
      setEstimatorProspectsAccess(false)
    }
  }

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error && error.message?.includes('Refresh Token')) {
        void supabase.auth.signOut()
      }
      applySession(session)
      setLoading(false)
    }).catch(() => {
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
    loading,
    checkSession,
    sessionExpiresAt,
  }

  return createElement(AuthContext.Provider, { value }, children)
}

export function useAuth(): UseAuthReturn {
  const ctx = useContext(AuthContext)
  if (ctx == null) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
