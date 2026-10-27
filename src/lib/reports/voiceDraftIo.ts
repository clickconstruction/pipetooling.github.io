/**
 * The form's one call for a drafted report (punch list #186, item 1, PR 2 of its plan, v2.5916): `report-draft` as the
 * signed-in tech. The answer is the draft with what it cost, or a reason the form can act on: no key yet, or a failure,
 * and either way the words go into Notes as they were said. Never throws.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { supabase } from '../supabase'
import { parseDraft, type RequestDraft } from './voiceDraft'

export function supabaseRequestDraft(client: SupabaseClient<Database> = supabase): RequestDraft {
  return async (request) => {
    try {
      const { data, error } = await client.functions.invoke('report-draft', { body: request })
      const d = (data ?? null) as Record<string, unknown> | null
      if (d && d.ok === true) {
        const draft = parseDraft(d.draft)
        if (draft) return { ok: true, draft, cents: typeof d.cents === 'number' ? d.cents : null }
      }
      // The function's own words ride on a non-2xx body when the client kept the response; else the plain reason.
      const body = await bodyOf(error)
      const code = d?.error ?? body?.error
      const words = d?.words ?? body?.words
      return { ok: false, reason: code === 'noKey' ? 'noKey' : 'failed', words: typeof words === 'string' ? words : '' }
    } catch {
      return { ok: false, reason: 'failed', words: '' }
    }
  }
}

/** The JSON body of a function's refusal, when the client kept the response. */
async function bodyOf(error: unknown): Promise<Record<string, unknown> | null> {
  const ctx = (error as { context?: unknown } | null)?.context
  if (!ctx || typeof (ctx as { json?: unknown }).json !== 'function') return null
  try {
    const parsed = await (ctx as { json: () => Promise<unknown> }).json()
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}
