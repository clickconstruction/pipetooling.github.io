/**
 * Their paper's reads and writes (punch list #173, v2.6698). The kernel is `theirPaper.ts`; this
 * file is the supabase at its edge: the save (one `job_contracts` row with kind `their_paper`),
 * the file upload into the contract bucket, and the batch readers' second read of the paper's own
 * columns. The new columns land with migration 20261108120000; until the generated types carry
 * them the payload is cast, and `check:calls-ahead` cannot see a column, so the batch readers keep
 * the coverage columns and read the paper's columns only for rows whose kind says so — a read from
 * before the push finds no such row and asks nothing more.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { JOB_CONTRACT_BUCKET, paperUploadPath } from './jobContractFileWrite'
import type { JobContractRow } from './jobContractLifecycle'
import { THEIR_PAPER_KIND, theirPaperColumnsFromDraft, type TheirPaperColumns, type TheirPaperDraft } from './theirPaper'

/** The paper's own columns, read by id for the rows the coverage read says are their paper. */
export const THEIR_PAPER_COLUMNS = 'id, paper_title, our_signer_name, our_signed_on, our_signed_how, their_signed_on, relied_on_on, relied_on_what, key_terms'

/**
 * Fill the their-paper rows of a batch read with their own columns. Rows of any other kind come
 * back as they were; a failed read leaves the rows as they were (the chip then says signed by us
 * only without the relied-on words, never nothing).
 */
export async function withTheirPaperColumns<T extends { id: string; kind?: string | null }>(rows: ReadonlyArray<T>): Promise<T[]> {
  const ids = rows.filter((r) => r.kind === THEIR_PAPER_KIND).map((r) => r.id)
  if (ids.length === 0) return [...rows]
  try {
    const { data, error } = await supabase.from('job_contracts').select(THEIR_PAPER_COLUMNS).in('id', ids)
    if (error || !data) return [...rows]
    const byId = new Map((data as unknown as Array<TheirPaperColumns & { id: string }>).map((r) => [r.id, r]))
    return rows.map((r) => (byId.has(r.id) ? { ...r, ...byId.get(r.id) } : r))
  } catch {
    return [...rows]
  }
}

export async function saveTheirPaper(input: {
  jobId: string
  /** The record being edited, or null for a new one. */
  existingId: string | null
  draft: TheirPaperDraft
  file: File | null
  authUserId: string | null
}): Promise<{ row: JobContractRow; uploadError: string | null }> {
  const cols = theirPaperColumnsFromDraft(input.draft)
  const payload = { ...cols, recorded_by: input.authUserId }
  const row = input.existingId
    ? await withSupabaseRetry<JobContractRow>(() => supabase.from('job_contracts').update(payload as never).eq('id', input.existingId!).select('*').single(), 'save their paper')
    : await withSupabaseRetry<JobContractRow>(() => supabase.from('job_contracts').insert({ ...payload, job_id: input.jobId, created_by: input.authUserId } as never).select('*').single(), 'record their paper')
  if (!row) throw new Error('The record was not saved.')
  let uploadError: string | null = null
  if (input.file) {
    const path = paperUploadPath(row.id, input.file.name)
    const { error: upErr } = await supabase.storage.from(JOB_CONTRACT_BUCKET).upload(path, input.file, { contentType: input.file.type || undefined, upsert: true })
    if (upErr) uploadError = upErr.message || 'upload failed'
    else await withSupabaseRetry(() => supabase.from('job_contracts').update({ paper_upload_path: path }).eq('id', row.id), 'attach their paper')
  }
  await supabase.from('job_contract_events').insert({
    contract_id: row.id,
    event_type: 'recorded',
    metadata: { their_paper: true, relied_on: cols.relied_on_on, terms: cols.key_terms.length, file: !!input.file },
    actor_user_id: input.authUserId,
  })
  return { row, uploadError }
}
