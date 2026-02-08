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

      // 5 minutes before expiry - show warning once
      if (timeUntilExpiry < 5 * 60 * 1000 && !warningShownRef.current) {
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
    }
  }, [checkSession, sessionExpiresAt])

  return { user, loading, checkSession, sessionExpiresAt }
}
