/**
 * A Drive file's text as the service account reads it (v2.6306 for the excerpt line, lifted here for the index in
 * punch list #240's PR 1, v2.6319): a Google Doc, Sheet or Slides exported as text; a PDF under the caps through unpdf's
 * text layer (a dynamic import, so a runtime that cannot load it costs a read and never the boot), a page at a time
 * inside a time budget (`pdfPagesText`, v2.6332), under 20 characters of text being a scan; a text file as its bytes; an
 * email's parts decoded (`.eml`, #285); a picture a scan too, for OCR later. Anything else is a kind we do not
 * read. One reader for `drive-link`'s excerpts, its `index`, the sweep and the dev seat's backfill: never a second one.
 * `textFromBytes` is the half past the download (#285), so a file whose bytes live in a bucket instead of Drive — a
 * staged evidence file, a matter document — is read by the same rules.
 */
import { DRIVE } from './driveUpload.ts'
import { driveMedia } from './driveJobFolder.ts'
import { emlToText } from './emlText.ts'
import { type DriveFileMeta, EXCERPT_READ_MS, exportMimeOf, type FileTextRead, INDEX_PDF_LIMITS, type PassSpend, PDF_SCAN_MAX_CHARS, type PdfDoc, pdfPagesText, type PdfReadLimits, TEXT_PLAIN_MAX_BYTES, textKindOf } from './fileIndexKernel.ts'

export type { FileTextRead }

/** How a PDF is read for this caller, and what the whole request has spent; the index's limits when none are named. */
export interface FileTextOpts {
  limits?: PdfReadLimits
  spend?: PassSpend
}

/**
 * A file's text from its bytes, by its kind (#285): a PDF through its text layer inside the limits and the request's
 * spend, a text file as its bytes, an email decoded, a picture a scan, anything else a kind we do not read. A Google
 * file never comes here, since it has no bytes to hold: `fileText` exports it from Drive.
 */
export async function textFromBytes(data: Uint8Array, f: Pick<DriveFileMeta, 'name' | 'mimeType'>, opts: FileTextOpts = {}): Promise<FileTextRead> {
  const kind = textKindOf(f)
  if (kind === 'pdf') {
    const limits = opts.limits ?? INDEX_PDF_LIMITS
    if (data.length > limits.maxBytes) return { why: 'big' }
    if (opts.spend) {
      // Checked here and not before the download: a search's reads start together, and only the parse is what they share.
      if (opts.spend.ms >= limits.passBudgetMs) return { why: 'slow' }
      // What the request's reads hold together: a search's ten downloads land at once, and memory is what they share.
      if (opts.spend.bytes > 0 && opts.spend.bytes + data.length > limits.passMaxBytes) return { why: 'big' }
      opts.spend.bytes += data.length
    }
    const started = performance.now()
    try {
      const { getDocumentProxy } = await import('npm:unpdf@2.1.0')
      const pdf = await getDocumentProxy(data)
      try {
        const { text, pagesRead } = await pdfPagesText(pdf as unknown as PdfDoc, limits, () => performance.now())
        return text.replace(/\s+/g, '').length < PDF_SCAN_MAX_CHARS ? { why: 'scan' } : { text, source: 'pdf_layer', pages: pdf.numPages, pagesRead }
      } finally {
        // The document holds the file's bytes; a pass may read several, and memory is the limit they share.
        void Promise.resolve(pdf.loadingTask?.destroy?.()).catch(() => {})
      }
    } finally {
      if (opts.spend) opts.spend.ms += performance.now() - started
    }
  }
  if (kind === 'plain' || kind === 'eml') {
    if (data.length > TEXT_PLAIN_MAX_BYTES) return { why: 'big' }
    const text = new TextDecoder('utf-8').decode(data)
    return { text: kind === 'eml' ? emlToText(text) : text, source: 'plain', pages: null }
  }
  if (kind === 'image') return { why: 'scan' }
  return { why: 'kind' }
}

export async function fileText(google: string, f: Pick<DriveFileMeta, 'id' | 'name' | 'mimeType' | 'size'>, opts: FileTextOpts = {}): Promise<FileTextRead> {
  const bytes = f.size == null || f.size === '' ? null : Number(f.size)
  const kind = textKindOf(f)
  if (kind === 'export') {
    const res = await fetch(`${DRIVE}/files/${encodeURIComponent(f.id)}/export?mimeType=${encodeURIComponent(exportMimeOf(f.mimeType))}`, { headers: { Authorization: `Bearer ${google}` } })
    if (res.ok) return { text: await res.text(), source: 'export', pages: null }
    // A kind Drive will not export is `kind` for good; one too big to export is `big`; anything else (a rate limit, a
    // 5xx) is `error`, which a retry takes again, never a `kind` that no retry reads.
    const reason = await res.text().catch(() => '')
    if (res.status === 400) return { why: 'kind' }
    if (res.status === 403 && /exportSizeLimitExceeded/.test(reason)) return { why: 'big' }
    return { why: 'error' }
  }
  if (kind === 'pdf') {
    const limits = opts.limits ?? INDEX_PDF_LIMITS
    // Over the cap by Drive's own count there is no download at all.
    if (bytes != null && bytes > limits.maxBytes) return { why: 'big' }
    const res = await driveMedia(google, f.id)
    if (!res.ok) return { why: 'error' }
    return textFromBytes(new Uint8Array(await res.arrayBuffer()), f, opts)
  }
  if (kind === 'plain' || kind === 'eml') {
    if (bytes != null && bytes > TEXT_PLAIN_MAX_BYTES) return { why: 'big' }
    const res = await driveMedia(google, f.id)
    return res.ok ? textFromBytes(new Uint8Array(await res.arrayBuffer()), f, opts) : { why: 'error' }
  }
  if (kind === 'image') return { why: 'scan' }
  return { why: 'kind' }
}

/** The read raced against a timer: past it the answer is `slow`; a read that throws is `error`, logged, never the caller's failure. */
export async function fileTextWithin(google: string, f: Pick<DriveFileMeta, 'id' | 'name' | 'mimeType' | 'size'>, ms = EXCERPT_READ_MS, opts: FileTextOpts = {}): Promise<FileTextRead> {
  return readWithin(() => fileText(google, f, opts), f.id, ms)
}

/** Any read raced against a timer, the way `fileTextWithin` races Drive's (#285: a bucket read runs under the same clock). */
export async function readWithin(read: () => Promise<FileTextRead>, id: string, ms: number): Promise<FileTextRead> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const slow = new Promise<FileTextRead>((resolve) => {
    timer = setTimeout(() => resolve({ why: 'slow' }), ms)
  })
  try {
    return await Promise.race([read(), slow])
  } catch (e) {
    console.warn('file text read failed', id, e instanceof Error ? e.message : String(e))
    return { why: 'error' }
  } finally {
    clearTimeout(timer)
  }
}
