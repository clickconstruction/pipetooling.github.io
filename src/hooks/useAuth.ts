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

  // Handle user activity and refresh session if needed
  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
    
    // If we have a session and it's within 10 minutes of expiry, refresh it
    if (sessionExpiresAt) {
      const timeUntilExpiry = sessionExpiresAt - Date.now()
      
      // Refresh if within 10 minutes of expiry
      if (timeUntilExpiry > 0 && timeUntilExpiry < 10 * 60 * 1000) {
        // Debounce: only refresh once per minute
        if (refreshTimeoutRef.current) return
        
        refreshTimeoutRef.current = setTimeout(() => {
          refreshTimeoutRef.current = undefined
        }, 60 * 1000)
        
        // Refresh the session
        supabase.auth.refreshSession().then(({ data, error }) => {
          if (!error && data.session) {
            setSessionExpiresAt(data.session.expires_at ? data.session.expires_at * 1000 : null)
            warningShownRef.current = false // Reset warning flag
          }
        })
      }
    }
  }, [sessionExpiresAt])

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

    // Check session expiry every minute
    const expiryCheckInterval = setInterval(() => {
      if (!sessionExpiresAt) return

      const timeUntilExpiry = sessionExpiresAt - Date.now()
      
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
  }, [checkSession, sessionExpiresAt, handleActivity])

  return { user, loading, checkSession, sessionExpiresAt }
}
