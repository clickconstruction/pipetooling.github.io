/**
 * Named documents on a person's HR file (v2.6614, punch list #277 PR 2): the rows the Documents view lists and opens,
 * the words it draws for each, and the checks on a file dropped in through *From a file*. Pure: no io. The table and
 * the view are `person_documents` / `person_document_index` (migration 20261107040000); the write is the same function
 * the summary and narrative save through, by document id or a new title (`hrDocEditor.ts`).
 */

/** One row of `person_document_index`: a named document without its text. */
export type PersonDocumentIndexRow = {
  id: string
  person_id: string
  title: string
  counsel_only: boolean
  author_label: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  chars: number
  sections: number
  /** v2.6713 (punch list #287): the evidence record this document transcribes, or null. Null too before the column is pushed. */
  evidence_id: string | null
}

/** A document read whole, for the reading pane and the editor. */
export type PersonDocumentRow = PersonDocumentIndexRow & { content: string }

/** The most a document may hold, the function's own limit. */
export const PERSON_DOCUMENT_MAX_CHARS = 1_000_000
/** A title, the function's own limit. */
export const PERSON_DOCUMENT_TITLE_MAX = 160

/** Newest kept first; archived ones out. */
export function sortDocumentsNewestFirst<T extends { updated_at: string; archived_at: string | null }>(rows: readonly T[]): T[] {
  return rows.filter((r) => !r.archived_at).sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0))
}

/** "24 sections · 180 KB" / "1 section · 2 KB" / "4 KB" when there are no headings. */
export function documentSizeWords(row: { chars: number; sections: number }): string {
  const kb = row.chars < 1024 ? `${row.chars} characters` : `${Math.round(row.chars / 1024).toLocaleString('en-US')} KB`
  if (row.sections <= 0) return kb
  return `${row.sections} ${row.sections === 1 ? 'section' : 'sections'} · ${kb}`
}

/** "Kept by Dana" — the author label, or the agent when none was written. */
export function documentKeptByWords(row: { author_label: string | null }): string {
  return `Kept by ${row.author_label?.trim() || 'the agent'}`
}

/** How many count on the tab: the two fixed documents that exist plus the named ones. */
export function documentsTabCount(args: { hasSummary: boolean; hasNarrative: boolean; named: number }): number {
  return (args.hasSummary ? 1 : 0) + (args.hasNarrative ? 1 : 0) + args.named
}

export type DocumentFileCheck = { ok: true; title: string; text: string } | { ok: false; why: string }

/** The kinds of file *From a file* takes, by name: markdown or plain text. */
export function documentFileIsText(name: string): boolean {
  return /\.(md|markdown|txt)$/i.test(name.trim())
}

/** A title from a file name: the extension off, dashes and underscores to spaces, trimmed to the limit. */
export function titleFromFileName(name: string): string {
  const base = name.trim().replace(/^.*[\\/]/, '').replace(/\.(md|markdown|txt)$/i, '')
  return base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, PERSON_DOCUMENT_TITLE_MAX)
}

/**
 * A file read in the browser, checked before the editor opens on it: the name must say markdown or plain text, the text
 * must have words and fit the function's limit. The title is proposed from the name; the person edits it before Save.
 */
export function checkDocumentFile(name: string, text: string): DocumentFileCheck {
  if (!documentFileIsText(name)) return { ok: false, why: `${name.trim() || 'That file'} is not a markdown or plain text file. Pick a .md or .txt file.` }
  if (text.trim() === '') return { ok: false, why: `${name.trim()} has no words in it.` }
  if (text.length > PERSON_DOCUMENT_MAX_CHARS) return { ok: false, why: `${name.trim()} holds ${text.length.toLocaleString('en-US')} characters; a document holds at most ${PERSON_DOCUMENT_MAX_CHARS.toLocaleString('en-US')}.` }
  const title = titleFromFileName(name)
  return { ok: true, title: title || 'Untitled document', text }
}

/** A title typed or proposed, trimmed and bounded; '' when there is nothing to save under. */
export function cleanDocumentTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim().slice(0, PERSON_DOCUMENT_TITLE_MAX)
}

/** What a transcript needs of its record (`personEvidence.ts`), for the chip on the document's header. */
export type TranscribedRecord = { id: string; title: string; dated_on: string; counsel_only?: boolean; files: ReadonlyArray<{ sha256?: string | null }> }

/**
 * The chip on a document's header (v2.6713, punch list #287): the record's title, its day and the first twelve
 * characters of its hash — the same number a folder's SHA256 list carries — so a reader matches the transcript to the
 * recording without opening either. `dayWords` is the panel's own day formatter. A record of linked files alone has
 * no hash, so the chip stops at the day.
 */
export function transcribedRecordWords(record: TranscribedRecord, dayWords: (ymd: string) => string): string {
  const hash = record.files.map((f) => (f.sha256 ?? '').trim().toLowerCase()).find((h) => /^[0-9a-f]{64}$/.test(h))
  const parts = [`Transcribes ${record.title.trim() || 'a record'}`, dayWords(record.dated_on)]
  if (hash) parts.push(`sha256 ${hash.slice(0, 12)}…`)
  return parts.join(' · ')
}

/** The documents by the record each transcribes, for *Transcript on file* on the record's row and its Timeline line. */
export function documentsByEvidenceId<T extends { evidence_id: string | null; archived_at: string | null; updated_at: string }>(rows: readonly T[]): Map<string, T> {
  const m = new Map<string, T>()
  const kept = rows.filter((r) => !r.archived_at && r.evidence_id).sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0))
  for (const r of kept) if (r.evidence_id && !m.has(r.evidence_id)) m.set(r.evidence_id, r)
  return m
}

/**
 * Why a document may not be tied to a record, before the function says the same: a counsel-only record's transcript is
 * counsel-only too. Null when the pair is fine. The function holds the rule as well (`dev_person_doc_write`).
 */
export function tieToRecordProblem(doc: { counsel_only: boolean }, record: { counsel_only?: boolean } | null): string | null {
  if (record?.counsel_only && !doc.counsel_only) return 'That record is counsel-only, so its transcript is counsel-only too. Mark the document counsel-only first.'
  return null
}

/** A record as the picker lists it: the day, the title, the lock when counsel-only, and the document already on it. */
export function recordPickWords(record: { title: string; dated_on: string; counsel_only?: boolean }, dayWords: (ymd: string) => string, takenBy: { title: string } | null): string {
  return `${dayWords(record.dated_on)} · ${record.title.trim() || 'untitled'}${record.counsel_only ? ' · 🔒 counsel-only' : ''}${takenBy ? ` · transcript: ${takenBy.title}` : ''}`
}
