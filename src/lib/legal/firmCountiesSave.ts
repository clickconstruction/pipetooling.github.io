/**
 * The one write of a county map (punch list #222, PR 2, v2.6221; one database call since PR 3, v2.6227): the
 * Settings picker, **Firms…** and the firm window's *Extend coverage* all save through here, so the doors can never
 * write a county two ways. Each changed county goes to `legal_save_county_coverage` with the firms that should cover
 * it, its first call, and the firms this picker read; the database reads every county before it writes any, so a
 * refusal changes nothing, and a county another tab changed since the picker read it comes back `stale`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatErrorMessage } from '../../utils/errorHandling'
import { countySavePayload, type CountyChange } from './firmCounties'

export type CountySaveResult = { ok: true } | { ok: false; conflict: boolean; message: string }

export const COUNTY_SAVE_CONFLICT_WORDS = 'Another tab saved a county first. The map shows what stands now.'

/** The save's refusal in the office's words: the database update not pushed yet reads as that, not as Postgres. */
export function countySaveErrorWords(error: unknown): string {
  const text = formatErrorMessage(error)
  if (/legal_save_county_coverage/.test(text) && /(could not find|does not exist|schema cache)/i.test(text)) return 'Saving counties needs a database update that is not live yet. Ask a dev to push it, then try again.'
  return `Could not save: ${text}`
}

export async function saveCountyChanges(db: SupabaseClient, changes: ReadonlyArray<CountyChange>): Promise<CountySaveResult> {
  if (changes.length === 0) return { ok: true }
  const { data, error } = await db.rpc('legal_save_county_coverage', { p_counties: countySavePayload(changes) })
  if (error) return { ok: false, conflict: false, message: countySaveErrorWords(error) }
  const answer = (data ?? {}) as { ok?: boolean; error?: string }
  if (answer.error === 'stale') return { ok: false, conflict: true, message: COUNTY_SAVE_CONFLICT_WORDS }
  if (answer.error) return { ok: false, conflict: false, message: answer.error }
  return { ok: true }
}
