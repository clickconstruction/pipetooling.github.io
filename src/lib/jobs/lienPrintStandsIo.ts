import { supabase } from '../supabase'
import type { LienPrintPaperKind } from './lienPrintSworn'
import type { LienPrintStandsChange, LienPrintStandsRow } from './lienPrintStands'

/**
 * The read and the one write behind *It stands as printed* (punch list #362, step 7). The rule is
 * `lienPrintStands.ts`. The table is `lien_print_stands` and the write is `set_lien_print_stands` (migration
 * 20261125210500), which stamps who and when on the server: nothing here writes the table itself.
 *
 * Neither is in the generated types until the migration is pushed and the types are drawn again, so both go through
 * one untyped door.
 */
type Answer<T> = { data: T | null; error: { code?: string; message?: string } | null }
type Untyped = {
  from: (table: string) => { select: (cols: string) => { is: (col: string, v: null) => { order: (col: string, o: { ascending: boolean }) => PromiseLike<Answer<unknown[]>> } } }
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<Answer<unknown>>
}
const db = supabase as unknown as Untyped

const text = (v: unknown): string => (typeof v === 'string' ? v : '')

function changesOf(raw: unknown): LienPrintStandsChange[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((one): LienPrintStandsChange[] => {
    if (!one || typeof one !== 'object') return []
    const r = one as Record<string, unknown>
    return text(r.key) ? [{ key: text(r.key), label: text(r.label), printed: text(r.printed), now: text(r.now) }] : []
  })
}

export function lienPrintStandsFromRow(raw: unknown): LienPrintStandsRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const paper = r.paper === 'notice' || r.paper === 'affidavit' ? r.paper : null
  if (!text(r.id) || !text(r.job_id) || !paper || !text(r.change_key)) return null
  return { id: text(r.id), jobId: text(r.job_id), paper, changeKey: text(r.change_key), changes: changesOf(r.changes), sentDocumentId: text(r.sent_document_id) || null, stoodBy: text(r.stood_by), stoodAt: text(r.stood_at) }
}

/** Every answer that stands (not taken back), for every job: a few rows a run. Null when the read failed. */
export async function readLienPrintStands(): Promise<LienPrintStandsRow[] | null> {
  try {
    const { data, error } = await db.from('lien_print_stands').select('id, job_id, paper, change_key, changes, sent_document_id, stood_by, stood_at').is('taken_back_at', null).order('stood_at', { ascending: true })
    if (error) return null
    return (data ?? []).map(lienPrintStandsFromRow).filter((r): r is LienPrintStandsRow => !!r)
  } catch {
    return null
  }
}

export type LienPrintStandsWrite = { jobId: string; paper: LienPrintPaperKind } & ({ stands: true; changeKey: string; changes: ReadonlyArray<LienPrintStandsChange>; sentDocumentId: string | null } | { stands: false })

/** Say a changed paper stands as printed, or take that back. Throws with the function's own words when it refuses. */
export async function writeLienPrintStands(w: LienPrintStandsWrite): Promise<{ changed: boolean }> {
  const args = w.stands
    ? { p_job_id: w.jobId, p_paper: w.paper, p_stands: true, p_change_key: w.changeKey, p_changes: w.changes.map((c) => ({ key: c.key, label: c.label, printed: c.printed, now: c.now })), p_sent_document_id: w.sentDocumentId }
    : { p_job_id: w.jobId, p_paper: w.paper, p_stands: false }
  const { data, error } = await db.rpc('set_lien_print_stands', args)
  if (error) throw error
  const answer = (data ?? null) as { ok?: boolean; changed?: boolean; error?: string } | null
  if (!answer || answer.error || !answer.ok) throw new Error(answer?.error || (w.stands ? 'The answer was not kept.' : 'The answer was not taken back.'))
  return { changed: Boolean(answer.changed) }
}
