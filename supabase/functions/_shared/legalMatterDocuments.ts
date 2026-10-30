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
  /** Whose paper it is (v2.6108); absent or null is our own record. */
  whose?: LegalDocumentWhose | null
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

// ---------- whose paper it is (punch list #214, v2.6108) ----------

/**
 * Whose paper a document is, the way a lawyer reads a file: the payer's (`theirs`), what we wrote
 * to them (`ours`), the public record (`public`: the City's, the county's, a board's, a statute),
 * a supply house's (`supplier`); null is our own record — captures, cost reports, affidavits, the
 * texts. The column `legal_matter_documents.whose` (v2.6106) holds it; a row with none is drawn
 * under the guess from its title, never written back.
 */
export const LEGAL_DOCUMENT_WHOSE = ['theirs', 'ours', 'public', 'supplier'] as const
export type LegalDocumentWhose = (typeof LEGAL_DOCUMENT_WHOSE)[number]

/** A group on the Evidence tab: a `whose`, or `record` for the rows with none. */
export type LegalDocumentGroupKey = LegalDocumentWhose | 'record'
/** The order the groups read in: the firm's first asks — their paper, then ours — first. */
export const LEGAL_DOCUMENT_GROUP_ORDER: ReadonlyArray<LegalDocumentGroupKey> = ['theirs', 'ours', 'public', 'supplier', 'record']

export function legalDocumentWhoseOf(raw: unknown): LegalDocumentWhose | null {
  return typeof raw === 'string' && (LEGAL_DOCUMENT_WHOSE as ReadonlyArray<string>).includes(raw) ? (raw as LegalDocumentWhose) : null
}

/** *Northline's* · *Burd & Assoc.'* — the payer's name as a possessive; *The payer's* with no name. */
export function legalDocumentPayerPossessive(payerName: string): string {
  const name = payerName.trim()
  if (!name) return 'The payer’s'
  return /s$/i.test(name) ? `${name}’` : `${name}’s`
}

/** The group's heading: the payer's name as a possessive, *Ours*, *Public record*, *The supplier's*, *Our record*. */
export function legalDocumentGroupWords(key: LegalDocumentGroupKey, payerName: string): string {
  switch (key) {
    case 'theirs': return legalDocumentPayerPossessive(payerName)
    case 'ours': return 'Ours'
    case 'public': return 'Public record'
    case 'supplier': return 'The supplier’s'
    default: return 'Our record'
  }
}

/** The add form's and the ⋯ menu's choice words, in the pick order: theirs · ours · public · supplier · the record. */
export function legalDocumentWhoseChoices(payerName: string): ReadonlyArray<{ value: LegalDocumentWhose | ''; words: string }> {
  return [
    { value: 'theirs', words: legalDocumentGroupWords('theirs', payerName) },
    { value: 'ours', words: 'Ours' },
    { value: 'public', words: 'Public record' },
    { value: 'supplier', words: 'The supplier’s' },
    { value: '', words: 'Our record' },
  ]
}

const PUBLIC_WORDS = /\b(city|county|state of|board’s|board's|court|clerk|permit|inspection|inspector|statute|law|code|ordinance|recorder|appraisal)\b/i
const RECORD_WORDS = /\b(captured?|as read|screenshots?|transcripts?|texts? with|phone call|call with|notes?|summary|reports?|cost|plan detail|specification|dealings|chronology|timeline|mail receipt|tracking|usps|affidavit)\b/i
const SUPPLIER_WORDS = /\b(invoices?|receipt|statement|payoff|quote from|supply|supplier)\b/i
const OURS_WORDS = /^(proposal|estimate|quote|response|letter|notice|demand|settlement offer|offer|final invoice|invoice|pay application|billing|email to)\b/i

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const NAME_STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'at', 'on', 'in', 'by', 'for', 'llc', 'inc', 'co', 'ltd', 'corp', 'gc'])

/** The payer's telling word as a pattern — the first word that is not *The*, *LLC* or the like and has three letters, e.g. *Northline* from *Northline Builders LLC*; '' when none. */
function payerKey(payerName: string): string {
  for (const raw of payerName.trim().split(/\s+/)) {
    const word = raw.replace(/[^A-Za-z0-9&'’-]/g, '')
    if (word.length >= 3 && !NAME_STOPWORDS.has(word.toLowerCase().replace(/[.,]/g, ''))) return word
  }
  return ''
}

/**
 * The guess for a row with no `whose`: drawn under its group, never written back, so a wrong guess
 * costs one press and no record. The rules in order: the public record's words; *to <payer>* is
 * ours; a capture, a report or a transcript is our record; the payer's name as a possessive, or
 * among the title's first three words, or a shows line that opens with it, is theirs; a sent paper is ours and a received one
 * theirs; a supply house's invoice or receipt; a paper that opens like a letter or a bill is ours.
 */
export function legalDocumentWhoseGuess(d: { title: string; shows?: string; state?: string }, payerName: string, ourName = ''): LegalDocumentWhose | null {
  const title = (d.title ?? '').trim()
  const shows = (d.shows ?? '').trim()
  const payer = payerKey(payerName)
  const payerRe = payer ? new RegExp(`\\b${escapeRe(payer)}\\b`, 'i') : null
  const payerPossessiveRe = payer ? new RegExp(`\\b${escapeRe(payer)}(?:'|’)s?\\b`, 'i') : null
  const toPayerRe = payer ? new RegExp(`\\bto ${escapeRe(payer)}\\b`, 'i') : null
  if (PUBLIC_WORDS.test(title)) return 'public'
  if (toPayerRe && toPayerRe.test(title)) return 'ours'
  if (RECORD_WORDS.test(title)) return null
  if (payerPossessiveRe && (payerPossessiveRe.test(title) || payerPossessiveRe.test(shows.slice(0, 40)))) return 'theirs'
  if (payerRe && payerRe.test(title.split(/\s+/).slice(0, 3).join(' '))) return 'theirs'
  if (d.state === 'sent') return 'ours'
  if (d.state === 'received') return 'theirs'
  if (SUPPLIER_WORDS.test(title)) return 'supplier'
  const our = ourName.trim().split(/\s+/)[0] ?? ''
  if (our && new RegExp(`^${escapeRe(our)}\\b`, 'i').test(title)) return 'ours'
  if (OURS_WORDS.test(title)) return 'ours'
  return null
}

/** The group a row sits under: its own `whose`, else the guess. `guessed` says which. */
export function legalDocumentGroupOf(d: { whose?: string | null; title: string; shows?: string; state?: string }, payerName: string, ourName = ''): { key: LegalDocumentGroupKey; guessed: boolean } {
  const own = legalDocumentWhoseOf(d.whose)
  if (own) return { key: own, guessed: false }
  if (d.whose === '' || d.whose === undefined || d.whose === null) {
    const guess = legalDocumentWhoseGuess(d, payerName, ourName)
    return { key: guess ?? 'record', guessed: guess !== null }
  }
  return { key: 'record', guessed: false }
}

/** *draft* · *final* · *received* · *sent · certified mail* · *sent · email* — the state as a chip on an Evidence row (v2.6108). */
export function legalDocumentStateChipWords(d: Pick<LegalPortalDocument, 'state' | 'sentHow'>): string {
  if (d.state === 'sent') {
    const how = legalDocumentSentHowWords(d.sentHow).replace(/^by /, '')
    return how ? `sent · ${how}` : 'sent'
  }
  return d.state
}

export type LegalDocumentGroup<T> = { key: LegalDocumentGroupKey; words: string; rows: T[] }

/**
 * The rows under their headings, in `LEGAL_DOCUMENT_GROUP_ORDER`, an empty group left out; within
 * a group the paper's day newest first (`dayOf`), then the title. `whose` on a row wins; a row with
 * none sits under the guess.
 */
export function groupLegalDocumentsByWhose<T extends { whose?: string | null; title: string; shows?: string; state?: string }>(rows: ReadonlyArray<T>, payerName: string, dayOf: (row: T) => string, ourName = ''): LegalDocumentGroup<T>[] {
  const by = new Map<LegalDocumentGroupKey, T[]>()
  for (const row of rows) {
    const { key } = legalDocumentGroupOf(row, payerName, ourName)
    by.set(key, [...(by.get(key) ?? []), row])
  }
  const out: LegalDocumentGroup<T>[] = []
  for (const key of LEGAL_DOCUMENT_GROUP_ORDER) {
    const list = by.get(key)
    if (!list?.length) continue
    list.sort((a, b) => (dayOf(b) || '').localeCompare(dayOf(a) || '') || a.title.localeCompare(b.title))
    out.push({ key, words: legalDocumentGroupWords(key, payerName), rows: list })
  }
  return out
}

/** The Evidence tab's filters (v2.6108), where the count was: every paper, the sent, the received, the drafts, the held, the ones added this week. */
export const LEGAL_DOCUMENT_FILTERS = ['all', 'sent', 'received', 'draft', 'held', 'week'] as const
export type LegalDocumentFilter = (typeof LEGAL_DOCUMENT_FILTERS)[number]

export function legalDocumentFilterWords(f: LegalDocumentFilter): string {
  switch (f) {
    case 'all': return 'All'
    case 'sent': return 'Sent'
    case 'received': return 'Received'
    case 'draft': return 'Drafts'
    case 'held': return 'Held'
    case 'week': return 'Added this week'
  }
}

/** Whether a row passes a filter; `weekStartYmd` is the Sunday the company week began, `addedOn` the row's added day. */
export function legalDocumentPassesFilter(d: { state: string; held: boolean; addedOn: string }, f: LegalDocumentFilter, weekStartYmd: string): boolean {
  switch (f) {
    case 'all': return true
    case 'sent': return d.state === 'sent'
    case 'received': return d.state === 'received'
    case 'draft': return d.state === 'draft'
    case 'held': return d.held
    case 'week': return Boolean(weekStartYmd) && d.addedOn >= weekStartYmd
  }
}

export function legalDocumentFilterCounts(rows: ReadonlyArray<{ state: string; held: boolean; addedOn: string }>, weekStartYmd: string): Record<LegalDocumentFilter, number> {
  const out: Record<LegalDocumentFilter, number> = { all: 0, sent: 0, received: 0, draft: 0, held: 0, week: 0 }
  for (const f of LEGAL_DOCUMENT_FILTERS) out[f] = rows.filter((r) => legalDocumentPassesFilter(r, f, weekStartYmd)).length
  return out
}

/** What an emptied filter says, with the press that shows every paper again. */
export function legalDocumentFilterEmptyWords(f: LegalDocumentFilter): string {
  switch (f) {
    case 'sent': return 'Nothing sent from this matter yet.'
    case 'received': return 'Nothing received on this matter yet.'
    case 'draft': return 'Nothing in draft.'
    case 'held': return 'Nothing held from the firm.'
    case 'week': return 'Nothing added this week.'
    default: return 'Nothing yet.'
  }
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
