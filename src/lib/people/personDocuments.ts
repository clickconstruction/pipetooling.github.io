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

/**
 * Which list a document sits in (v2.6693, punch list #277 open call 1): the Named documents list holds the kept ones
 * newest first; the Archived (n) fold at the foot holds the archived ones, the most recently archived first. A document
 * is archived when `archived_at` is set, whatever else it carries.
 */
export function splitDocumentsByArchive<T extends { updated_at: string; archived_at: string | null }>(rows: readonly T[]): { kept: T[]; archived: T[] } {
  const archived = rows
    .filter((r): r is T & { archived_at: string } => Boolean(r.archived_at))
    .sort((a, b) => (a.archived_at < b.archived_at ? 1 : a.archived_at > b.archived_at ? -1 : a.updated_at < b.updated_at ? 1 : -1))
  return { kept: sortDocumentsNewestFirst(rows), archived }
}

/** The fold's summary line: "Archived (2)". */
export function archivedFoldWords(count: number): string {
  return `Archived (${count})`
}

/** The confirm before Archive: what leaves, what stays, and a button that names the act (`confirmLabel`). */
export function archiveConfirmWords(title: string): { title: string; body: string; confirmLabel: string } {
  return {
    title: 'Archive this document?',
    body: `${title} leaves the Named documents list for the Archived fold at the foot, read-only. Nothing is deleted, and Unarchive brings it back.`,
    confirmLabel: 'Archive the document',
  }
}

/** The line an archived document wears when open: "Archived Nov 8, 2026 · read-only until Unarchive". */
export function archivedDocumentWords(dateWords: string): string {
  return `Archived ${dateWords} · read-only until Unarchive`
}

/** The toast after the press: "Interview guide is archived." / "Interview guide is back on the list." */
export function archiveOutcomeWords(title: string, archived: boolean): string {
  return archived ? `${title} is archived.` : `${title} is back on the list.`
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

/** How many count on the tab: the two fixed documents that exist plus the named ones kept (archived ones do not count). */
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
