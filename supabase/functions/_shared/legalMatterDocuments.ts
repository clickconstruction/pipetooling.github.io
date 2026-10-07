/**
 * Documents from the office on a legal matter (v2.4810): what may travel to the firm, the
 * limits on a file, and the words. Pure and dependency-free, so the `legal-portal` function,
 * the Legal desk and the firm's page read one rule. `src/lib/legal/legalMatterDocuments.ts`
 * is the client's door.
 */

export const LEGAL_MATTER_DOCUMENTS_BUCKET = 'legal-matter-documents'

/** 10 MB a file: a scanned contract or an email thread as PDF; never a video. */
export const LEGAL_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024

/** What the office may put on a matter. An email thread goes as .eml or printed to PDF. */
export const LEGAL_DOCUMENT_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'message/rfc822', 'text/plain'] as const

/** The row as the firm may hold it: never the storage path, the hold reason or who held it. */
export const MATTER_DOCUMENT_COUNSEL_COLUMNS = ['id', 'title', 'shows', 'mime', 'size_bytes', 'added_at'] as const

/** The keys of a document on the firm's payload; `shapeMatterForCounsel` cuts each document to these. */
export const MATTER_DOCUMENT_PAYLOAD_KEYS = ['id', 'title', 'shows', 'mime', 'sizeBytes', 'addedOn', 'addedByName', 'url'] as const

export type LegalPortalDocument = {
  id: string
  title: string
  shows: string
  mime: string
  sizeBytes: number
  /** YYYY-MM-DD */
  addedOn: string
  addedByName: string
  /** A 15-minute signed link, '' on the office's preview and the sample. */
  url: string
}

export type LegalDocumentDraft = { title: string; shows: string }

/** Null when the draft may be saved; else the one thing it still needs. */
export function legalDocumentProblem(d: LegalDocumentDraft, file?: { size: number; type: string; name: string } | null): string | null {
  if (!d.title.trim()) return 'Give the document a title.'
  if (!d.shows.trim()) return 'Say in one line what it shows.'
  if (file) {
    const mime = legalDocumentMime(file)
    if (!mime) return `${file.name} is not a kind the portal takes: PDF, an image, an email (.eml) or plain text.`
    if (file.size > LEGAL_DOCUMENT_MAX_BYTES) return `${file.name} is over ${LEGAL_DOCUMENT_MAX_BYTES / 1024 / 1024} MB.`
  }
  return null
}

/** The mime the file goes in as: the browser's, else from the name; '' when it is not a kind we take. */
export function legalDocumentMime(file: { type: string; name: string }): string {
  const t = (file.type || '').toLowerCase()
  if ((LEGAL_DOCUMENT_MIMES as ReadonlyArray<string>).includes(t)) return t
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  const byExt: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', eml: 'message/rfc822', txt: 'text/plain' }
  return byExt[ext] ?? ''
}

/** `<matter id>/<document id>-<name with only safe characters>`. */
export function legalDocumentStoragePath(matterId: string, documentId: string, originalName: string): string {
  const safe = originalName.replace(/[^A-Za-z0-9._ -]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'document'
  return `${matterId}/${documentId}-${safe}`
}

/** `63 KB` · `1.2 MB` */
export function legalDocumentSizeWords(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** `PDF` · `Image` · `Email` · `Text` */
export function legalDocumentKindWords(mime: string): string {
  if (mime === 'application/pdf') return 'PDF'
  if (mime.startsWith('image/')) return 'Image'
  if (mime === 'message/rfc822') return 'Email'
  if (mime === 'text/plain') return 'Text'
  return 'File'
}

/** The title the form starts with: the file's name without its extension. */
export function legalDocumentTitleFromName(name: string): string {
  return name.replace(/\.[A-Za-z0-9]{1,5}$/, '').replace(/[_]+/g, ' ').trim()
}

/** A row from the table → the firm's document; the url is the caller's. */
export function legalPortalDocumentFromRow(row: { id: string; title: string; shows: string; mime?: string | null; size_bytes?: number | null; added_at?: string | null }, addedByName: string, url: string, dayOf: (iso: string) => string): LegalPortalDocument {
  return {
    id: row.id,
    title: (row.title ?? '').trim(),
    shows: (row.shows ?? '').trim(),
    mime: (row.mime ?? '').trim(),
    sizeBytes: Number(row.size_bytes ?? 0) || 0,
    addedOn: row.added_at ? dayOf(row.added_at) : '',
    addedByName,
    url,
  }
}

/** The payload's documents, read defensively: an older function sends none. */
export function parseLegalPortalDocuments(raw: unknown): LegalPortalDocument[] {
  if (!Array.isArray(raw)) return []
  const out: LegalPortalDocument[] = []
  for (const d of raw) {
    if (!d || typeof d !== 'object') continue
    const r = d as Record<string, unknown>
    if (typeof r.id !== 'string' || typeof r.title !== 'string') continue
    out.push({
      id: r.id,
      title: r.title,
      shows: typeof r.shows === 'string' ? r.shows : '',
      mime: typeof r.mime === 'string' ? r.mime : '',
      sizeBytes: typeof r.sizeBytes === 'number' && Number.isFinite(r.sizeBytes) ? r.sizeBytes : 0,
      addedOn: typeof r.addedOn === 'string' ? r.addedOn : '',
      addedByName: typeof r.addedByName === 'string' ? r.addedByName : '',
      url: typeof r.url === 'string' && /^https:\/\//.test(r.url) ? r.url : '',
    })
  }
  return out
}
