/**
 * A Drive file's text as the service account reads it (v2.6306 for the excerpt line, lifted here for the index in
 * punch list #240's PR 1, v2.6319): a Google Doc, Sheet or Slides exported as text; a PDF under the caps through unpdf's
 * text layer (a dynamic import, so a runtime that cannot load it costs a read and never the boot), under 20 characters
 * of text being a scan; a text file as its bytes; a picture a scan too, for OCR later. Anything else is a kind we do not
 * read. One reader for `drive-link`'s excerpts, its `index`, the sweep and the dev seat's backfill: never a second one.
 */
import { DRIVE } from './driveUpload.ts'
import { driveMedia } from './driveJobFolder.ts'
import { EXCERPT_READ_MS, PDF_SCAN_MAX_CHARS, TEXT_PDF_MAX_BYTES, TEXT_PDF_MAX_PAGES, TEXT_PLAIN_MAX_BYTES, textKindOf, type DriveFileMeta, type FileTextRead } from './fileIndexKernel.ts'

export type { FileTextRead }

export async function fileText(google: string, f: Pick<DriveFileMeta, 'id' | 'name' | 'mimeType' | 'size'>): Promise<FileTextRead> {
  const bytes = f.size == null || f.size === '' ? null : Number(f.size)
  const kind = textKindOf(f)
  if (kind === 'export') {
    const res = await fetch(`${DRIVE}/files/${encodeURIComponent(f.id)}/export?mimeType=text/plain`, { headers: { Authorization: `Bearer ${google}` } })
    return res.ok ? { text: await res.text(), source: 'export', pages: null } : { why: 'kind' }
  }
  if (kind === 'pdf') {
    if (bytes != null && bytes > TEXT_PDF_MAX_BYTES) return { why: 'big' }
    const res = await driveMedia(google, f.id)
    if (!res.ok) return { why: 'error' }
    const data = new Uint8Array(await res.arrayBuffer())
    if (data.length > TEXT_PDF_MAX_BYTES) return { why: 'big' }
    const { getDocumentProxy, extractText } = await import('npm:unpdf@2.1.0')
    const pdf = await getDocumentProxy(data)
    if (pdf.numPages > TEXT_PDF_MAX_PAGES) return { why: 'big' }
    const { text } = await extractText(pdf, { mergePages: true })
    const t = typeof text === 'string' ? text : (text as string[]).join('\n')
    return t.replace(/\s+/g, '').length < PDF_SCAN_MAX_CHARS ? { why: 'scan' } : { text: t, source: 'pdf_layer', pages: pdf.numPages }
  }
  if (kind === 'plain') {
    if (bytes != null && bytes > TEXT_PLAIN_MAX_BYTES) return { why: 'big' }
    const res = await driveMedia(google, f.id)
    return res.ok ? { text: await res.text(), source: 'plain', pages: null } : { why: 'error' }
  }
  if (kind === 'image') return { why: 'scan' }
  return { why: 'kind' }
}

/** The read raced against a timer: past it the answer is `slow`; a read that throws is `error`, logged, never the caller's failure. */
export async function fileTextWithin(google: string, f: Pick<DriveFileMeta, 'id' | 'name' | 'mimeType' | 'size'>, ms = EXCERPT_READ_MS): Promise<FileTextRead> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const slow = new Promise<FileTextRead>((resolve) => {
    timer = setTimeout(() => resolve({ why: 'slow' }), ms)
  })
  try {
    return await Promise.race([fileText(google, f), slow])
  } catch (e) {
    console.warn('file text read failed', f.id, e instanceof Error ? e.message : String(e))
    return { why: 'error' }
  } finally {
    clearTimeout(timer)
  }
}
