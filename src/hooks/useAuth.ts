import { useEffect, useState, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface UseAuthReturn {
  user: User | null
  loading: boolean
  checkSession: () => Promise<boolean>
  sessionExpiresAt: number | null
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
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
      setSessionExpiresAt(null)
      return false
    }
    
    setSessionExpiresAt(session.expires_at ? session.expires_at * 1000 : null)
    return true
  }, [])

  // Handle user activity and refresh session if needed (reads from ref to avoid effect re-runs)
  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    const expiresAt = sessionExpiresAtRef.current
    if (!expiresAt) return
    
    const timeUntilExpiry = expiresAt - Date.now()
    if (timeUntilExpiry <= 0 || timeUntilExpiry >= 10 * 60 * 1000) return
    
    if (refreshTimeoutRef.current) return
    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = undefined
    }, 60 * 1000)
    
    supabase.auth.refreshSession().then(({ data, error }) => {
      if (!error && data.session) {
        setSessionExpiresAt(data.session.expires_at ? data.session.expires_at * 1000 : null)
        warningShownRef.current = false
      }
    })
  }, [])

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error && error.message?.includes('Refresh Token')) {
        void supabase.auth.signOut()
      }
      setUser(session?.user ?? null)
      setSessionExpiresAt(session?.expires_at ? session.expires_at * 1000 : null)
      setLoading(false)
    }).catch(() => {
      setUser(null)
      setSessionExpiresAt(null)
      setLoading(false)
    })

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setSessionExpiresAt(session?.expires_at ? session.expires_at * 1000 : null)

      // Skip reload: SIGNED_IN fires on session restore and token refresh too, causing reload loops.
      // Cache clearing after explicit sign-in can be done in SignIn.tsx after successful login if needed.
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
      if (timeUntilExpiry < 5 * 60 * 1000 && !warningShownRef.current && !hasRecentActivity) {
        warningShownRef.current = true
        // Dispatch custom event for warning
        window.dispatchEvent(new CustomEvent('session-expiring', {
          detail: { minutesRemaining: Math.ceil(timeUntilExpiry / 60000) }
        }))
      }

      // Reset warning flag if session refreshed
      if (timeUntilExpiry > 10 * 60 * 1000) {
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

  return { user, loading, checkSession, sessionExpiresAt }
}
