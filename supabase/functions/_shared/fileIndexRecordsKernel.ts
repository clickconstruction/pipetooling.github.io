/**
 * The index's reach to a person's HR file and a matter (punch list #285, PR 1, v2.6714): the rules, pure, so
 * `src/lib/documents/fileIndexRecordsKernel.test.ts` reads them as the functions do. A record's file — a
 * `person_file_attachments` row staged in the hr-files bucket or linked from Drive, a `legal_matter_documents` row in
 * its bucket — becomes a `file_index` row keyed on its own id, with `source`, the row it stands for, the person or
 * matter it hangs on and the evidence record's counsel-only mark; the text columns are the index's own
 * (`readColumns`). The queue is the RPC `file_index_records_due` (migration 20261108200000); this file decides where a
 * record's bytes are read from, what its row says and what the pass reports.
 */
import { type DriveFileMeta, type FileIndexRow, type FileTextRead, type HeldFile, type IndexSource, indexPassWords, readColumns } from './fileIndexKernel.ts'

/** How many records the sweep's records step takes a run (each a bucket or Drive read inside the pass's budget). */
export const SWEEP_RECORD_ROWS = 10
/** How many records one call of the seat's backfill takes at most, and its default. */
export const RECORDS_BATCH_DEFAULT = 10
export const RECORDS_BATCH_MAX = 25

/** A row of `file_index_records_due`, as the RPC answers it. */
export interface RecordDue {
  source: Exclude<IndexSource, 'drive'>
  source_id: string
  person_id: string | null
  matter_id: string | null
  counsel_only: boolean
  name: string
  mime: string
  bytes: number | null
  bucket: string
  storage_path: string | null
  drive_file_id: string | null
  record_kind: 'evidence' | 'entry' | 'file' | 'matter_document'
  record_id: string
  record_title: string | null
  record_day: string | null
  path: string
  modified_at: string
  /** A held row being taken again (slow, error or reading, checked over an hour ago), not a record with no row. */
  held: boolean
}

/** Where a record's bytes are: the staged copy in its bucket, the Drive file a link names, or nowhere the index can read (a link that names no file). */
export type RecordBytesWhere = 'bucket' | 'drive' | 'none'

export function recordBytesWhere(r: Pick<RecordDue, 'storage_path' | 'drive_file_id'>): RecordBytesWhere {
  if (r.storage_path) return 'bucket'
  if (r.drive_file_id) return 'drive'
  return 'none'
}

/** The file as the text reader sees it: the record's id as the file's, its name, the kind the row says, Drive's size when the row has one. */
export function recordFileMeta(r: Pick<RecordDue, 'source_id' | 'name' | 'mime' | 'bytes' | 'modified_at'>): DriveFileMeta {
  return { id: r.source_id, name: r.name, mimeType: r.mime, size: r.bytes == null ? null : String(r.bytes), modifiedTime: r.modified_at, parents: null, webViewLink: null, trashed: false }
}

/** What a Drive read learned of a linked file, kept on the row over what the attachment said: its kind and its size. */
export interface RecordFileFacts {
  mime?: string | null
  bytes?: number | null
}

/**
 * A record's row: keyed on the record file's own id, no job or bid (a record is never in the jobs drive), `other` as
 * its folder, the path as the RPC words it (People › the person › the day and title; Matter › the payer › Evidence),
 * and the read's columns. `now` is the stamp.
 */
export function recordRowOf(r: RecordDue, read: FileTextRead | { why: 'reading' }, now: Date, facts: RecordFileFacts = {}): FileIndexRow {
  const bytes = facts.bytes ?? r.bytes
  return {
    drive_file_id: r.source_id,
    source: r.source,
    source_id: r.source_id,
    person_id: r.person_id,
    matter_id: r.matter_id,
    counsel_only: r.counsel_only,
    jobs_ledger_id: null,
    bid_id: null,
    customer_id: null,
    folder_kind: 'other',
    path: (r.path || '').slice(0, 2000),
    name: (r.name || 'Untitled').slice(0, 1000),
    mime: (facts.mime || r.mime || 'application/octet-stream').slice(0, 200),
    bytes: bytes != null && Number.isFinite(bytes) ? bytes : null,
    modified_at: r.modified_at ?? null,
    ...readColumns(read, now),
  }
}

/** The row stamped before a read starts, as `readingRowOf` does for a Drive file: a stopped request leaves `reading`, read as `slow` after. */
export function recordReadingRowOf(r: RecordDue, now: Date): FileIndexRow {
  return recordRowOf(r, { why: 'reading' }, now)
}

/** The answer of one records pass: the rows whose record was gone, the queue's size, what was taken, held and left. */
export interface RecordsPassResult {
  dropped: number
  due: number
  tried: number
  indexed: number
  held: HeldFile[]
  remaining: number
}

export const EMPTY_RECORDS_PASS: RecordsPassResult = { dropped: 0, due: 0, tried: 0, indexed: 0, held: [], remaining: 0 }

/** The pass's line for the log and the answer: nothing when the queue was empty and nothing was dropped. */
export function recordsPassWords(r: RecordsPassResult): string {
  if (r.due === 0 && r.dropped === 0) return ''
  const dropped = r.dropped > 0 ? ` Dropped ${r.dropped} whose record is gone.` : ''
  if (r.due === 0) return `Records: nothing waiting.${dropped}`
  return `Records: ${indexPassWords({ indexed: r.indexed, held: r.held, remaining: r.remaining })}${dropped}`
}

/** The queue window one pass asks for: enough past its take to say what remains, under the RPC's cap. */
export function recordsWindow(n: number): number {
  return Math.min(500, Math.max(50, n * 4))
}
