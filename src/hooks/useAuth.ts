import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get session, handling refresh token errors gracefully
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      // Ignore invalid refresh token errors - they just mean the user needs to sign in again
      if (error && error.message?.includes('Refresh Token')) {
        // Clear any invalid tokens
        void supabase.auth.signOut()
      }
      setUser(session?.user ?? null)
      setLoading(false)
    }).catch(() => {
      // Silently handle any other errors during session retrieval
      setUser(null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}
