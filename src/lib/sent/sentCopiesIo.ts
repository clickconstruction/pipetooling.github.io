/**
 * Sent copies (v2.4554) — the reads and the writes. The rules are `sentCopies.ts`.
 *
 * Filing is best effort and never throws: a send must not fail, or wait, because its copy
 * could not be kept. When the copy cannot be stored the row is still written, with no path,
 * so the list says it went and that the copy was not kept.
 *
 * `sent_documents` is applied after the client ships (docs/migrations). Until then a filing
 * quietly does nothing and a read answers no rows.
 */
import { supabase } from '../supabase'
import { openHtmlPrintWindow, openHtmlWindowWhenReady } from '../jobsDocuments/printWindow'
import { fileNameOf, openOrSaveFromStorage } from '../storageSave'
import { type SentCopy, type SentCopyBody, type SentCopyStored, type SentFiling, type SentKindGroup, parseSentCopy, sentCopyDoor, sentCopyFrameHtml, sentCopyPath, sentDocumentInsert, sentKindGroupFilter, sentSearchFilter } from './sentCopies'

/** The private bucket the copies live in: `<sent_documents.id>/<file>`. */
export const SENT_COPIES_BUCKET = 'sent-documents'

const SENT_COLS = 'id, kind, title, how, recipient_name, recipient_emails, subject, source_table, source_id, copy_path, copy_type, copy_hash, attachments, sent_at, sent_by_name'

/** The table is not in the generated types until its migration is applied. */
const table = () => supabase.from('sent_documents' as never)

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return ''
  }
}

/** The copy in the bucket: the one already kept for this same page when there is one, else a new file. Null when it cannot be kept. */
async function storeCopy(rowId: string, kind: string, body: SentCopyBody): Promise<SentCopyStored | null> {
  const blob = 'html' in body ? new Blob([body.html], { type: 'text/html' }) : body.blob
  const type = 'html' in body ? 'text/html' : body.contentType || blob.type || 'application/octet-stream'
  const hash = await sha256Hex(await blob.arrayBuffer())
  if (hash) {
    // A second print of the same page points at the first copy. Only the office can read the
    // table, so anyone else simply keeps a copy of their own.
    const { data } = await table().select('copy_path, copy_type, copy_bytes').eq('kind', kind).eq('copy_hash', hash).not('copy_path', 'is', null).limit(1)
    const kept = ((data ?? []) as unknown as Array<{ copy_path: string | null; copy_type: string | null; copy_bytes: number | null }>)[0]
    if (kept?.copy_path) return { path: kept.copy_path, type: kept.copy_type || type, hash, bytes: kept.copy_bytes ?? blob.size }
  }
  const path = sentCopyPath(rowId, body)
  const { error } = await supabase.storage.from(SENT_COPIES_BUCKET).upload(path, blob, { contentType: type, upsert: false })
  if (error) return null
  return { path, type, hash, bytes: blob.size }
}

/**
 * File one send: keep the copy, then write the row. Resolves to whether the row was written.
 * Never throws. Call it without awaiting from a click that must stay quick.
 */
export async function fileSentCopy(filing: SentFiling, body: SentCopyBody | null): Promise<boolean> {
  try {
    const id = crypto.randomUUID()
    if (!sentDocumentInsert(id, filing, null)) return false
    const stored = body ? await storeCopy(id, filing.kind, body).catch(() => null) : null
    const row = sentDocumentInsert(id, filing, stored)
    if (!row) return false
    const { error } = await table().insert(row as never)
    return !error
  } catch {
    return false
  }
}

/**
 * Print a page and file it: a print counts as a send. False when the print window was
 * blocked, as `openHtmlPrintWindow`; nothing is filed then.
 */
export function printAndFile(html: string, filing: Omit<SentFiling, 'how'>): boolean {
  if (!openHtmlPrintWindow(html)) return false
  void fileSentCopy({ ...filing, how: 'print' }, { html })
  return true
}

/**
 * `printAndFile` for a page that needs a moment to build (a signed waiver reads its stored ink
 * first): the window opens inside the click, prints when the page is ready, and the page that
 * printed is filed. False when the popup was blocked or the page could not be built.
 */
export async function printWhenReadyAndFile(build: () => Promise<string>, filing: Omit<SentFiling, 'how'>): Promise<boolean> {
  let printed: string | null = null
  const ok = await openHtmlWindowWhenReady(
    async () => {
      printed = await build()
      return printed
    },
    { print: true },
  )
  if (ok && printed != null) void fileSentCopy({ ...filing, how: 'print' }, { html: printed })
  return ok
}

/** Everything sent about one job, newest first. A read that fails is no rows. */
export async function loadSentCopiesForJob(jobId: string): Promise<SentCopy[]> {
  try {
    const { data, error } = await table().select(SENT_COLS).contains('job_ids', [jobId]).order('sent_at', { ascending: false }).limit(500)
    if (error) return []
    return ((data ?? []) as unknown[]).map(parseSentCopy).filter((r): r is SentCopy => !!r)
  } catch {
    return []
  }
}

async function copyText(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(SENT_COPIES_BUCKET).download(path)
  if (error || !data) throw error ?? new Error('No copy')
  return data.text()
}

/**
 * Open a row's copy as it went out: a kept page in a window of its own (framed, never run:
 * `sentCopyFrameHtml`), a kept file through a five-minute link. Call it inside the click. False when there is no copy or it could not open.
 */
export async function openSentCopy(row: Pick<SentCopy, 'copyPath' | 'copyType'>, label: string): Promise<boolean> {
  const door = sentCopyDoor(row)
  if (door === 'none' || !row.copyPath) return false
  if (door === 'page') return openHtmlWindowWhenReady(async () => sentCopyFrameHtml(await copyText(row.copyPath!), label))
  return openSentFile(row.copyPath)
}

/** Open a kept file the browser can show (a PDF) through a five-minute link; save one it cannot (a pay application workbook) from the app's own address (v2.4610). */
export async function openSentFile(path: string): Promise<boolean> {
  try {
    return await openOrSaveFromStorage(SENT_COPIES_BUCKET, path, fileNameOf(path, 'copy'))
  } catch {
    return false
  }
}

/**
 * Everything sent, newest first, for the Documents page: one group of papers or all of them,
 * narrowed by what was typed. Self-tests are left out. A read that fails is no rows.
 */
export async function loadSentCopies(opts: { group: SentKindGroup | 'all'; typed: string; limit: number }): Promise<SentCopy[]> {
  try {
    let q = table().select(SENT_COLS).neq('kind', 'self_test')
    const group = sentKindGroupFilter(opts.group)
    if (group?.or) q = q.or(group.or)
    for (const pattern of group?.notLike ?? []) q = q.not('kind', 'like', pattern)
    const search = sentSearchFilter(opts.typed)
    if (search) q = q.or(search)
    const { data, error } = await q.order('sent_at', { ascending: false }).limit(Math.max(1, Math.min(opts.limit, 1000)))
    if (error) return []
    return ((data ?? []) as unknown[]).map(parseSentCopy).filter((r): r is SentCopy => !!r)
  } catch {
    return []
  }
}
