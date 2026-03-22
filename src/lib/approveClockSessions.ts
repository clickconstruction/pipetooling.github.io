/**
 * approveClockSessions RPC helper with client-side fallbacks.
 * Uses explicit schema and fetch fallback when Supabase client returns 404.
 */

import { supabase } from './supabase'

export type ApproveClockSessionsResult = {
  data: Array<{ approved_count: number; error_message: string | null }> | null
  error: { message: string } | null
}

export async function approveClockSessions(sessionIds: string[]): Promise<ApproveClockSessionsResult> {
  // 1. Try Supabase RPC with explicit public schema (fixes some 404s)
  const { data, error } = await supabase.schema('public').rpc('approve_clock_sessions', {
    p_session_ids: sessionIds,
  })

  if (!error) {
    return { data, error: null }
  }

  // 2. On 404 or "could not find" / PGRST, retry with direct fetch (bypasses client quirks)
  const is404 =
    (error as { status?: number }).status === 404 ||
    (error as { code?: string }).code === 'PGRST202' ||
    /could not find|404|not found/i.test(error.message)

  if (is404) {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const url = import.meta.env.VITE_SUPABASE_URL
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (url && (token || anonKey)) {
      try {
        const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/approve_clock_sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: anonKey ?? '',
            Authorization: `Bearer ${token ?? anonKey}`,
            'Content-Profile': 'public',
            'Accept-Profile': 'public',
          },
          body: JSON.stringify({ p_session_ids: sessionIds }),
        })
        const text = await res.text()
        if (res.ok) {
          const parsed = text ? (JSON.parse(text) as ApproveClockSessionsResult['data']) : []
          return { data: parsed, error: null }
        }
        return {
          data: null,
          error: { message: `RPC failed (${res.status}): ${text.slice(0, 200)}` },
        }
      } catch (e) {
        console.warn('[approveClockSessions] fetch fallback failed:', e)
      }
    }
  }

  return { data: null, error: { message: error.message } }
}
