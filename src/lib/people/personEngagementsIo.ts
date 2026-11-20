import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import type { PersonEngagementRow } from './personEngagements'

/**
 * The read and the write of a person's standing over time (punch list #315, upgrade 4b): the stretches on
 * `person_engagements`, and its one door `dev_engagement_write`. Read on its own and fail-soft, so a read that fails
 * takes only the standing out of the file. The client is read untyped here, as `personCaseIo.ts` reads its tables.
 */
const db = supabase as unknown as import('@supabase/supabase-js').SupabaseClient

type Res<T> = { data: T | null; error: { message: string } | null }

const COLUMNS = 'id, kind, started_on, ended_on, source, source_ref, note, withdrawn_at'

/** Every stretch on the person's file, the withdrawn ones too: the kernel leaves those out of what stands. */
export async function loadPersonEngagements(personId: string): Promise<{ rows: PersonEngagementRow[]; heldWhy: string | null }> {
  try {
    const r = (await db.from('person_engagements').select(COLUMNS).eq('person_id', personId).order('started_on', { ascending: true })) as unknown as Res<PersonEngagementRow[]>
    if (r.error) return { rows: [], heldWhy: r.error.message }
    return { rows: r.data ?? [], heldWhy: null }
  } catch (e) {
    return { rows: [], heldWhy: formatErrorMessage(e) }
  }
}

/** The standing's door, as the dev's own hand: the write, not a dry run. The function refuses a bad change in words. */
export async function writePersonEngagement(payload: Record<string, unknown>): Promise<{ ok: true } | { ok: false; why: string }> {
  try {
    const r = (await db.rpc('dev_engagement_write', { p: payload, p_dry_run: false })) as unknown as Res<unknown>
    if (r.error) return { ok: false, why: r.error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, why: formatErrorMessage(e) }
  }
}
