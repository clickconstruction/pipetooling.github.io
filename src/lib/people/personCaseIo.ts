import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import type { ExhibitBackfillReport, PersonCaseItem, PersonCaseLogLine } from './personCase'

/**
 * The reads and writes of the rows a person's HR file numbers (punch list #315, upgrade 2): the exhibit numbers, a
 * case's open items and its log. Each is read on its own and fail-soft, so a read that fails takes only itself out of
 * the file. The tables and functions are not in the generated types until the types PR after their migration, so the
 * client is read untyped here, as `personEvidenceIo.ts` reads a column the types do not carry yet.
 */
const db = supabase as unknown as import('@supabase/supabase-js').SupabaseClient

type Res<T> = { data: T | null; error: { message: string } | null }

/** The number each evidence record goes by, by record id. A record made before the numbers has none until a dev numbers it. */
export async function loadExhibitNumbers(personId: string): Promise<{ byId: Map<string, number>; unnumbered: number; heldWhy: string | null }> {
  try {
    const r = (await db.from('person_file_evidence').select('id, exhibit_no').eq('person_id', personId)) as unknown as Res<Array<{ id: string; exhibit_no: number | null }>>
    if (r.error) return { byId: new Map(), unnumbered: 0, heldWhy: r.error.message }
    const byId = new Map<string, number>()
    let unnumbered = 0
    for (const row of r.data ?? []) {
      if (typeof row.exhibit_no === 'number') byId.set(row.id, row.exhibit_no)
      else unnumbered += 1
    }
    return { byId, unnumbered, heldWhy: null }
  } catch (e) {
    return { byId: new Map(), unnumbered: 0, heldWhy: formatErrorMessage(e) }
  }
}

const ITEM_COLUMNS = 'id, item_no, title, detail, owner_label, state, opened_at, closed_at, closed_why, author_label, session_label'
const LOG_COLUMNS = 'id, logged_at, line, item_no, author_label, session_label'

export async function loadPersonCase(personId: string): Promise<{ items: PersonCaseItem[]; log: PersonCaseLogLine[]; heldWhy: string | null }> {
  try {
    const [items, log] = (await Promise.all([
      db.from('person_case_items').select(ITEM_COLUMNS).eq('person_id', personId).order('item_no', { ascending: true }),
      db.from('person_case_log').select(LOG_COLUMNS).eq('person_id', personId).order('logged_at', { ascending: false }).limit(500),
    ])) as unknown as [Res<PersonCaseItem[]>, Res<PersonCaseLogLine[]>]
    if (items.error) return { items: [], log: [], heldWhy: items.error.message }
    if (log.error) return { items: items.data ?? [], log: [], heldWhy: log.error.message }
    return { items: items.data ?? [], log: log.data ?? [], heldWhy: null }
  } catch (e) {
    return { items: [], log: [], heldWhy: formatErrorMessage(e) }
  }
}

/** The case's door, as the dev's own hand: the write, not a dry run. The function refuses a bad change in words. */
export async function writePersonCase(payload: Record<string, unknown>): Promise<{ ok: true } | { ok: false; why: string }> {
  try {
    const r = (await db.rpc('dev_case_write', { p: payload, p_dry_run: false })) as unknown as Res<unknown>
    if (r.error) return { ok: false, why: r.error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, why: formatErrorMessage(e) }
  }
}

/** The backfill of exhibit numbers from the titles: a dry run to read, or the write. */
export async function runExhibitBackfill(input: { personId: string; dryRun: boolean; numberRest: boolean }): Promise<{ ok: true; report: ExhibitBackfillReport } | { ok: false; why: string }> {
  try {
    const r = (await db.rpc('dev_evidence_number_backfill', { p_person_id: input.personId, p_dry_run: input.dryRun, p_number_rest: input.numberRest })) as unknown as Res<ExhibitBackfillReport>
    if (r.error || !r.data) return { ok: false, why: r.error?.message ?? 'The file did not answer.' }
    return { ok: true, report: r.data }
  } catch (e) {
    return { ok: false, why: formatErrorMessage(e) }
  }
}
