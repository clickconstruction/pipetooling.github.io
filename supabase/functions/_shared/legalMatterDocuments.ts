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

/** The row as the firm may hold it: never the storage path, the hold reason or who held it. Since v2.5846 the paper's own day and its state. */
export const MATTER_DOCUMENT_COUNSEL_COLUMNS = ['id', 'title', 'shows', 'mime', 'size_bytes', 'added_at', 'dated_on', 'state', 'sent_on', 'sent_how', 'sent_to', 'proof_document_id', 'received_on'] as const

/** The keys of a document on the firm's payload; `shapeMatterForCounsel` cuts each document to these. */
export const MATTER_DOCUMENT_PAYLOAD_KEYS = ['id', 'title', 'shows', 'mime', 'sizeBytes', 'addedOn', 'addedByName', 'url', 'datedOn', 'state', 'sentOn', 'sentHow', 'sentTo', 'proofDocumentId', 'receivedOn'] as const

// ---------- the paper's own day, and draft · final · sent · received (punch list #168, v2.5846) ----------

/** A document is a draft (not yet what goes out), final (the paper as it stands), sent (it went out, with the record) or received (it came in). */
export const LEGAL_DOCUMENT_STATES = ['draft', 'final', 'sent', 'received'] as const
export type LegalDocumentState = (typeof LEGAL_DOCUMENT_STATES)[number]

/** How a sent paper went: the record's `sent_how`. */
export const LEGAL_DOCUMENT_SENT_HOWS = ['email', 'certified_mail', 'mail', 'hand', 'other'] as const
export type LegalDocumentSentHow = (typeof LEGAL_DOCUMENT_SENT_HOWS)[number]

export function legalDocumentStateOf(raw: unknown): LegalDocumentState {
  return typeof raw === 'string' && (LEGAL_DOCUMENT_STATES as ReadonlyArray<string>).includes(raw) ? (raw as LegalDocumentState) : 'final'
}

export function legalDocumentSentHowWords(how: string): string {
  switch (how) {
    case 'email': return 'by email'
    case 'certified_mail': return 'by certified mail'
    case 'mail': return 'by mail'
    case 'hand': return 'by hand'
    default: return ''
  }
}

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
  /** The paper's own day (v2.5846), YYYY-MM-DD; '' when none was given (an older row). */
  datedOn: string
  state: LegalDocumentState
  /** The send record (v2.5846) when `state` is sent; '' otherwise. */
  sentOn: string
  sentHow: string
  sentTo: string
  /** Another document on the matter that proves the send (the mailing receipt); '' when none. */
  proofDocumentId: string
  /** The day a received paper came in; '' otherwise. */
  receivedOn: string
}

export type LegalDocumentDraft = {
  title: string
  shows: string
  /** The paper's own day (v2.5846), YYYY-MM-DD; absent or '' means the day it is added. */
  datedOn?: string
  /** Absent means final. */
  state?: LegalDocumentState
  /** For a received paper: the day it came in; absent means the paper's own day. */
  receivedOn?: string
}

/** What *Mark sent…* asks (v2.5846). */
export type LegalDocumentSentDraft = { sentOn: string; sentHow: LegalDocumentSentHow | ''; sentTo: string; proofDocumentId: string }

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Null when the send record may be saved; else what it still needs. The day is never ahead of today. */
export function legalDocumentSentProblem(d: LegalDocumentSentDraft, todayYmd: string): string | null {
  if (!DAY.test(d.sentOn)) return 'Pick the day it went out.'
  if (d.sentOn > todayYmd) return 'The day it went out cannot be ahead of today.'
  if (!d.sentHow) return 'Say how it went out.'
  if (!d.sentTo.trim()) return 'Say who it went to.'
  return null
}

/** Null when the draft may be saved; else the one thing it still needs. */
export function legalDocumentProblem(d: LegalDocumentDraft, file?: { size: number; type: string; name: string } | null): string | null {
  if (!d.title.trim()) return 'Give the document a title.'
  if (!d.shows.trim()) return 'Say in one line what it shows.'
  if (d.datedOn && !DAY.test(d.datedOn)) return 'Pick the day the paper is from.'
  if (d.state === 'received' && d.receivedOn && !DAY.test(d.receivedOn)) return 'Pick the day it was received.'
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
export function legalPortalDocumentFromRow(
  row: { id: string; title: string; shows: string; mime?: string | null; size_bytes?: number | null; added_at?: string | null; dated_on?: string | null; state?: string | null; sent_on?: string | null; sent_how?: string | null; sent_to?: string | null; proof_document_id?: string | null; received_on?: string | null },
  addedByName: string,
  url: string,
  dayOf: (iso: string) => string,
): LegalPortalDocument {
  return {
    id: row.id,
    title: (row.title ?? '').trim(),
    shows: (row.shows ?? '').trim(),
    mime: (row.mime ?? '').trim(),
    sizeBytes: Number(row.size_bytes ?? 0) || 0,
    addedOn: row.added_at ? dayOf(row.added_at) : '',
    addedByName,
    url,
    datedOn: (row.dated_on ?? '').slice(0, 10),
    state: legalDocumentStateOf(row.state),
    sentOn: (row.sent_on ?? '').slice(0, 10),
    sentHow: (row.sent_how ?? '').trim(),
    sentTo: (row.sent_to ?? '').trim(),
    proofDocumentId: (row.proof_document_id ?? '').trim(),
    receivedOn: (row.received_on ?? '').slice(0, 10),
  }
}

/** *Draft* · '' (final) · *Sent Oct 27 by certified mail to Burd & Assoc.* · *Received Oct 22*. `day` words a YYYY-MM-DD. */
export function legalDocumentStateWords(d: Pick<LegalPortalDocument, 'state' | 'sentOn' | 'sentHow' | 'sentTo' | 'receivedOn'>, day: (ymd: string) => string = (y) => y): string {
  if (d.state === 'draft') return 'Draft'
  if (d.state === 'sent') return ['Sent', d.sentOn ? day(d.sentOn) : '', legalDocumentSentHowWords(d.sentHow), d.sentTo ? `to ${d.sentTo}` : ''].filter(Boolean).join(' ')
  if (d.state === 'received') return `Received${d.receivedOn ? ` ${day(d.receivedOn)}` : ''}`
  return ''
}

/** *dated May 12 · added Oct 24*, or just *added Oct 24* when the paper has no day of its own or the two agree. */
export function legalDocumentDayWords(d: Pick<LegalPortalDocument, 'datedOn' | 'addedOn'>, day: (ymd: string) => string = (y) => y): string {
  const added = d.addedOn ? `added ${day(d.addedOn)}` : ''
  if (d.datedOn && d.datedOn !== d.addedOn) return [`dated ${day(d.datedOn)}`, added].filter(Boolean).join(' · ')
  return added
}

/** The day a document sits on the Timeline: its own day, else the day it was added. */
export function legalDocumentTimelineDay(d: Pick<LegalPortalDocument, 'datedOn' | 'addedOn'>): string {
  return d.datedOn || d.addedOn
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
      datedOn: typeof r.datedOn === 'string' ? r.datedOn : '',
      state: legalDocumentStateOf(r.state),
      sentOn: typeof r.sentOn === 'string' ? r.sentOn : '',
      sentHow: typeof r.sentHow === 'string' ? r.sentHow : '',
      sentTo: typeof r.sentTo === 'string' ? r.sentTo : '',
      proofDocumentId: typeof r.proofDocumentId === 'string' ? r.proofDocumentId : '',
      receivedOn: typeof r.receivedOn === 'string' ? r.receivedOn : '',
    })
  }
  return out
}
