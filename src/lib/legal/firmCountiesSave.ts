/**
 * The one write of a county map (punch list #222, PR 2, v2.6221): the Settings picker, **Firms…** and the firm
 * window's *Extend coverage* all save through here, so the doors can never write a county two ways. The plan is
 * `countyWritePlan`'s: close the live row of every county that changes hands or clears, then insert the new live
 * rows; closes first, so the one-firm-per-county index never sees two live rows for a county. A unique violation
 * on the insert means another tab saved a county first.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatErrorMessage } from '../../utils/errorHandling'
import { countyWritePlan, type CountyChange } from './firmCounties'

export type CountySaveResult = { ok: true } | { ok: false; conflict: boolean; message: string }

export const COUNTY_SAVE_CONFLICT_WORDS = 'Another tab saved a county first. The map shows what stands now.'

export async function saveCountyChanges(db: SupabaseClient, changes: ReadonlyArray<CountyChange>, setBy: string | null, now: string = new Date().toISOString()): Promise<CountySaveResult> {
  if (changes.length === 0) return { ok: true }
  const plan = countyWritePlan(changes, setBy)
  for (const county of plan.close) {
    const { error } = await db.from('legal_firm_counties').update({ until: now }).eq('county', county).is('until', null)
    if (error) return { ok: false, conflict: false, message: `Could not save ${county}: ${formatErrorMessage(error)}` }
  }
  if (plan.insert.length > 0) {
    const { error } = await db.from('legal_firm_counties').insert(plan.insert.map((r) => ({ ...r, since: now })))
    if (error) {
      const conflict = (error as { code?: string }).code === '23505'
      return { ok: false, conflict, message: conflict ? COUNTY_SAVE_CONFLICT_WORDS : `Could not save: ${formatErrorMessage(error)}` }
    }
  }
  return { ok: true }
}
