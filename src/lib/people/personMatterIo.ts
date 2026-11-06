import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { legalRpcData } from '../../hooks/useLegalMatters'
import { listLegalMatterDocuments, type LegalMatterDocumentRow } from '../legal/legalMatterDocumentsIo'
import type { LegalEntryRow, LegalMatterRow } from '../legal/legalMatters'

/**
 * The reads and the one open for a matter on a person (v2.6543): the matter row standing on the person, its entries
 * (planned steps, events, statements) and its live documents. Every write after the open goes through the desk's own
 * RPCs (legal_set_narrative, legal_plan_add, legal_event_add, …) from the Matter view. The legal tables' RLS keeps a
 * person matter to devs; a read that fails for any other reason is named in `heldWhy`, and a missing table reads as
 * none (the migration not pushed yet), so the rest of the file still draws.
 */

const db = supabase as unknown as SupabaseClient

export type PersonMatterLoad = {
  matter: LegalMatterRow | null
  entries: LegalEntryRow[]
  documents: LegalMatterDocumentRow[]
  /** Why the legal tables could not be read, or null; a table not there yet reads as no matter. */
  heldWhy: string | null
}

const missing = (e: { code?: string; message?: string } | null | undefined): boolean => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist/i.test(e.message ?? ''))

export async function loadPersonMatter(personId: string): Promise<PersonMatterLoad> {
  const none: PersonMatterLoad = { matter: null, entries: [], documents: [], heldWhy: null }
  const m = await db.from('legal_matters').select('*').eq('person_id', personId).maybeSingle()
  if (m.error) {
    // The column lands with the migration; before it the filter itself is refused (42703), which reads as no matter.
    if (missing(m.error) || m.error.code === '42703') return none
    return { ...none, heldWhy: m.error.message }
  }
  // One row or none; a client that answers a list (a test's stub) is read the same way.
  const raw = m.data as unknown
  const matter = (Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null)) as LegalMatterRow | null
  if (!matter) return none
  const [e, docs] = await Promise.all([
    db.from('legal_matter_entries').select('*').eq('matter_id', matter.id).order('created_at'),
    listLegalMatterDocuments(supabase).then((rows) => rows.filter((d) => d.matter_id === matter.id), () => [] as LegalMatterDocumentRow[]),
  ])
  if (e.error && !missing(e.error)) return { matter, entries: [], documents: docs, heldWhy: e.error.message }
  return { matter, entries: ((e.data ?? []) as LegalEntryRow[]), documents: docs, heldWhy: null }
}

/** The matter row alone, for the fact strip's chip (v2.6582). */
export type PersonMatterStanding = Pick<LegalMatterRow, 'id' | 'stage' | 'closed_at' | 'closed_reason' | 'handling_name'>

/**
 * The matter standing on a person, the row alone (v2.6582, punch list #269 PR 3b): what the HR file's fact strip reads
 * for its Matter chip. Null when none stands, when the column is not pushed yet, or when the read is refused — the strip
 * draws no chip and the Matter view says why.
 */
export async function loadPersonMatterStanding(personId: string): Promise<PersonMatterStanding | null> {
  const m = await db.from('legal_matters').select('id,stage,closed_at,closed_reason,handling_name').eq('person_id', personId).maybeSingle()
  if (m.error) return null
  const raw = m.data as unknown
  return (Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null)) as PersonMatterStanding | null
}

export type OpenPersonMatterOutcome = { ok: true; matterId: string; made: boolean } | { ok: false; why: string }

/** Open the matter on this person, or find the one that stands (`legal_person_matter_open`, devs only). */
export async function openPersonMatter(personId: string, handlingName = ''): Promise<OpenPersonMatterOutcome> {
  const r = await legalRpcData('legal_person_matter_open', { p_person_id: personId, p_handling_name: handlingName })
  if (r.error) return { ok: false, why: r.error }
  const id = typeof r.data?.matter_id === 'string' ? r.data.matter_id : null
  if (!id) return { ok: false, why: 'The matter could not be made.' }
  return { ok: true, matterId: id, made: r.data?.made === true }
}
