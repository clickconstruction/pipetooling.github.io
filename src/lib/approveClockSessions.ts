/**
 * approveClockSessions RPC helper with client-side fallbacks.
 *
 * Calls `approve_clock_sessions_v2` (v2.4242), which also says how many sessions it left for
 * someone else — the caller typed the hours, or they are the caller's own. Falls back to
 * `approve_clock_sessions` when the v2 function is not on the database, with the explicit schema
 * and the direct-fetch retry that name has always had (the Supabase client returned 404 for it
 * on some setups).
 */

import { supabase } from './supabase'

export type ApproveClockSessionsRow = {
  approved_count: number
  error_message: string | null
  /** Left unapproved because they are the approver's own hours. Absent from the old RPC. */
  held_own?: number
  /** Left unapproved because the approver typed the hours. Absent from the old RPC. */
  held_typed?: number
}

export type ApproveClockSessionsResult = {
  data: ApproveClockSessionsRow[] | null
  error: { message: string } | null
}

function isMissingFunction(error: { message: string; status?: number; code?: string }): boolean {
  return error.status === 404 || error.code === 'PGRST202' || /could not find|404|not found/i.test(error.message)
}

/** The sessions an approve left for someone else, from its first result row. */
export function heldFromApproveResult(data: ApproveClockSessionsRow[] | null | undefined): { heldOwn: number; heldTyped: number } {
  const row = data?.[0]
  return { heldOwn: row?.held_own ?? 0, heldTyped: row?.held_typed ?? 0 }
}

export async function approveClockSessions(sessionIds: string[]): Promise<ApproveClockSessionsResult> {
  const v2 = await supabase.schema('public').rpc('approve_clock_sessions_v2', {
    p_session_ids: sessionIds,
  })
  if (!v2.error) {
    return { data: v2.data, error: null }
  }
  if (!isMissingFunction(v2.error as { message: string; status?: number; code?: string })) {
    return { data: null, error: { message: v2.error.message } }
  }

  // 1. Try Supabase RPC with explicit public schema (fixes some 404s)
  const { data, error } = await supabase.schema('public').rpc('approve_clock_sessions', {
    p_session_ids: sessionIds,
  })

  if (!error) {
    return { data, error: null }
  }

  // 2. On 404 or "could not find" / PGRST, retry with direct fetch (bypasses client quirks)
  if (isMissingFunction(error as { message: string; status?: number; code?: string })) {
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
