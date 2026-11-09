/**
 * The records pass (punch list #285, PR 1, v2.6714): the files a person's HR file and a legal matter hold, into
 * `file_index`. The queue is the RPC `file_index_records_due` (migration 20261108200000: every attachment and unvoided
 * matter document with no row, or a held one checked over an hour ago, newest first); each record is stamped `reading`,
 * its bytes read from its bucket (a staged evidence file, a matter document) or from Drive (a linked file, by the id its
 * link names, its kind and size read from Drive first), its text through the one reader (`textFromBytes` / `fileText`),
 * its row written keyed on its own id. One file at a time inside the request's budget and the pass's spend, as the Drive
 * pass runs, so a 10 MB PDF on a record costs the request what any PDF does and the rest waits for the next run. No
 * chunks: the case search is words-only and the embedding queue takes Drive rows alone, so a record's text never leaves
 * the table. Under the sweep's records step, the Drive filer's hook after a record lands, the seat's apply_matter_document
 * and its backfill verb.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { fileMeta } from './fileIndex.ts'
import { INDEX_BUDGET_MS, INDEX_READ_MS, PASS_READ_BUDGET_MS, type PassSpend, budgetAllows, newPassSpend, passMayTake, type HeldFile } from './fileIndexKernel.ts'
import { EMPTY_RECORDS_PASS, type RecordDue, type RecordFileFacts, type RecordsPassResult, recordBytesWhere, recordFileMeta, recordReadingRowOf, recordRowOf, recordsWindow } from './fileIndexRecordsKernel.ts'
import { type FileTextRead, fileText, readWithin, textFromBytes } from './fileText.ts'

export interface RecordsPassOpts {
  /** How many records this call takes at most. */
  n: number
  /** A Drive token for a linked file, minted only when one is met; null when the caller has no Drive (a linked file is then held `error` and taken an hour on). */
  google?: (() => Promise<string | null>) | null
  /** One person's files and their matter's documents, or one matter's documents; everything due when neither is named. */
  personId?: string | null
  matterId?: string | null
  /** Whether to drop the rows whose record is gone first (the sweep does; a hook after one filing need not). */
  dropGone?: boolean
  spend?: PassSpend
  startedMs?: number
  budgetMs?: number
}

/** The due records, as the RPC lists them; a queue the database refuses is logged and the pass does nothing this run. */
export async function recordsDue(admin: SupabaseClient, window: number, scope: { personId?: string | null; matterId?: string | null } = {}): Promise<RecordDue[] | null> {
  const { data, error } = await admin.rpc('file_index_records_due', { max_rows: window, p_person_id: scope.personId ?? null, p_matter_id: scope.matterId ?? null })
  if (error) {
    console.warn('file index records queue failed', error.message)
    return null
  }
  return (data ?? []) as RecordDue[]
}

/** One record's bytes read into text: from its bucket, or from Drive by the id its link names. `facts` is what Drive said of a linked file. */
async function readRecord(admin: SupabaseClient, r: RecordDue, google: RecordsPassOpts['google'], spend: PassSpend): Promise<{ read: FileTextRead; facts: RecordFileFacts }> {
  const where = recordBytesWhere(r)
  if (where === 'none') return { read: { why: 'kind' }, facts: {} }
  if (where === 'bucket') {
    const read = await readWithin(async () => {
      const dl = await admin.storage.from(r.bucket).download(r.storage_path!)
      if (dl.error || !dl.data) {
        console.warn('file index record did not download', r.source, r.source_id, dl.error?.message ?? 'empty')
        return { why: 'error' }
      }
      return textFromBytes(new Uint8Array(await dl.data.arrayBuffer()), recordFileMeta(r), { spend })
    }, r.source_id, INDEX_READ_MS)
    return { read, facts: {} }
  }
  const token = google ? await google() : null
  if (!token) return { read: { why: 'error' }, facts: {} }
  // A linked file's kind and size live in Drive, not on the attachment: read them first, so a Google Doc exports and a PDF is budgeted by its real size.
  const meta = await fileMeta(token, r.drive_file_id!)
  if (!meta || meta.trashed) return { read: { why: 'error' }, facts: {} }
  const facts: RecordFileFacts = { mime: meta.mimeType, bytes: meta.size == null || meta.size === '' ? null : Number(meta.size) }
  if (!passMayTake(meta, spend)) return { read: { why: 'slow' }, facts }
  const read = await readWithin(() => fileText(token, { ...meta, name: meta.name || r.name }, { spend }), r.source_id, INDEX_READ_MS)
  return { read, facts }
}

/**
 * The pass: the gone rows dropped, the queue read, then one record at a time while the budget and the spend allow, the
 * rest counted as remaining. A row the database refused is held as `error` with the reason in the log.
 */
export async function recordsPass(admin: SupabaseClient, opts: RecordsPassOpts): Promise<RecordsPassResult> {
  const out: RecordsPassResult = { ...EMPTY_RECORDS_PASS, held: [] }
  if (opts.n <= 0) return out
  if (opts.dropGone !== false) {
    const gone = await admin.rpc('file_index_records_drop_gone')
    if (gone.error) console.warn('file index records drop failed', gone.error.message)
    else out.dropped = Number(gone.data) || 0
  }
  const due = await recordsDue(admin, recordsWindow(opts.n), { personId: opts.personId, matterId: opts.matterId })
  if (!due) return out
  out.due = due.length
  const spend = opts.spend ?? newPassSpend()
  const started = opts.startedMs ?? Date.now()
  let taken = 0
  for (const r of due) {
    if (taken >= opts.n || !budgetAllows(started, Date.now(), opts.budgetMs ?? INDEX_BUDGET_MS) || spend.ms >= PASS_READ_BUDGET_MS) break
    // The attachment's own size gates a staged PDF before its download; a linked file's is read from Drive inside.
    if (recordBytesWhere(r) === 'bucket' && !passMayTake(recordFileMeta(r), spend)) break
    taken += 1
    out.tried += 1
    const stamp = await admin.from('file_index').upsert(recordReadingRowOf(r, new Date()), { onConflict: 'drive_file_id' })
    if (stamp.error) {
      console.warn('file index record stamp failed', r.source, r.source_id, stamp.error.message)
      out.held.push({ id: r.source_id, name: r.name, why: 'error' })
      continue
    }
    const { read, facts } = await readRecord(admin, r, opts.google ?? null, spend)
    const row = recordRowOf(r, read, new Date(), facts)
    const put = await admin.from('file_index').upsert(row, { onConflict: 'drive_file_id' })
    if (put.error) {
      console.warn('file index record write failed', r.source, r.source_id, put.error.message)
      out.held.push({ id: r.source_id, name: r.name, why: 'error' })
      continue
    }
    out.indexed += 1
    if ('why' in read) out.held.push({ id: r.source_id, name: r.name, why: read.why } as HeldFile)
  }
  out.remaining = due.length - taken
  return out
}
