import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import type { AmendmentKind, AmendmentTarget, PersonAmendmentRow } from './personAmendments'
import { doorLinksPayload, doorWithdrawPayload, withdrawRefusalMeansAlreadyOff } from './personAmendmentsDoor'

/**
 * The reads and writes of a person's correction links (`person_file_amendments`, punch list #315). The table is a
 * dev's alone, like the rest of the HR file, and is read on its own: a read that fails names its reason and takes
 * only the links out, so the Timeline's entries and evidence still draw.
 *
 * The writes go through `dev_hr_entry_write`, the dev-gated door the dev seat uses, and never straight at the table
 * (`personAmendmentsDoor.ts` says why). The door stamps who made a link and who took it off from the sign-in.
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

/** Link a thing just written to what it corrects or completes, one link a target, all or none. The guard refuses a bad pair in words. */
export async function addAmendments(input: { personId: string; fromKind: AmendmentKind; fromId: string; targets: ReadonlyArray<AmendmentTarget> }): Promise<{ ok: true; made: number } | { ok: false; why: string }> {
  if (input.targets.length === 0) return { ok: true, made: 0 }
  try {
    const p = doorLinksPayload(input)
    const r = await supabase.rpc('dev_hr_entry_write', { p, p_dry_run: false })
    if (r.error) return { ok: false, why: r.error.message }
    return { ok: true, made: p.amendments.length }
  } catch (e) {
    return { ok: false, why: formatErrorMessage(e) }
  }
}

/** Take a link off with its reason. The row stays, stamped; nothing else on it may change. */
export async function withdrawAmendment(id: string, why: string, personId: string): Promise<{ ok: true } | { ok: false; why: string }> {
  if (why.trim() === '') return { ok: false, why: 'Say why the link comes off.' }
  try {
    const r = await supabase.rpc('dev_hr_entry_write', { p: doorWithdrawPayload({ personId, id, why }), p_dry_run: false })
    if (r.error && !withdrawRefusalMeansAlreadyOff(r.error.message)) return { ok: false, why: r.error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, why: formatErrorMessage(e) }
  }
}
