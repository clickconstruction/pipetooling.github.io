import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { amendmentInsertRows, type AmendmentKind, type AmendmentTarget, type PersonAmendmentRow } from './personAmendments'

/**
 * The reads and writes of a person's correction links (`person_file_amendments`, punch list #315). The table is a
 * dev's alone, like the rest of the HR file, and is read on its own: a read that fails names its reason and takes
 * only the links out, so the Timeline's entries and evidence still draw.
 */
const COLUMNS = 'id, from_kind, from_id, to_kind, to_id, how, created_at, withdrawn_at'

export async function loadPersonAmendments(personId: string): Promise<{ rows: PersonAmendmentRow[]; heldWhy: string | null }> {
  try {
    const r = await supabase.from('person_file_amendments').select(COLUMNS).eq('person_id', personId)
    if (r.error) return { rows: [], heldWhy: r.error.message }
    return { rows: r.data ?? [], heldWhy: null }
  } catch (e) {
    return { rows: [], heldWhy: formatErrorMessage(e) }
  }
}

/** Link a thing just written to what it corrects or completes, one row a target. The guard refuses a bad pair in words. */
export async function addAmendments(input: { personId: string; fromKind: AmendmentKind; fromId: string; targets: ReadonlyArray<AmendmentTarget>; authUserId: string | null }): Promise<{ ok: true; made: number } | { ok: false; why: string }> {
  if (input.targets.length === 0) return { ok: true, made: 0 }
  try {
    const rows = amendmentInsertRows({ personId: input.personId, fromKind: input.fromKind, fromId: input.fromId, targets: input.targets, createdBy: input.authUserId })
    const r = await supabase.from('person_file_amendments').insert(rows)
    if (r.error) return { ok: false, why: r.error.message }
    return { ok: true, made: rows.length }
  } catch (e) {
    return { ok: false, why: formatErrorMessage(e) }
  }
}

/** Take a link off with its reason. The row stays, stamped; nothing else on it may change. */
export async function withdrawAmendment(id: string, why: string, authUserId: string | null): Promise<{ ok: true } | { ok: false; why: string }> {
  const reason = why.trim()
  if (reason === '') return { ok: false, why: 'Say why the link comes off.' }
  try {
    const r = await supabase.from('person_file_amendments').update({ withdrawn_at: new Date().toISOString(), withdrawn_by: authUserId, withdrawn_why: reason.slice(0, 200) }).eq('id', id).is('withdrawn_at', null)
    if (r.error) return { ok: false, why: r.error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, why: formatErrorMessage(e) }
  }
}
