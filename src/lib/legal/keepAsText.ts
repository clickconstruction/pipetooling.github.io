import { batchOutcomeWords, countedLabel, type BatchOutcome } from '../batchWords'
import { LEGAL_TEXT_DOCUMENT_MAX_CHARS, legalDocumentIsText } from './legalMatterDocuments'

/**
 * Keep an old text file's words as text (Legal desk → Evidence → Documents for the firm).
 *
 * A `.md` or `.txt` put on a matter since v2.6716 is a text document: its words sit in `documents` beside the stored
 * file, so the row has **Read** and, since v2.7683, the copy presses. A text file put on a matter before that is a
 * stored file alone. This kernel says which rows those are and holds the words of the press that turns one into a
 * text document: the row's menu line, the counted press over the list, and what the toast and the list say afterwards.
 * The reads and writes are `keepLegalMatterDocumentAsText` in `legalMatterDocumentsIo.ts`.
 */

/** What the kernel reads of an Evidence row. */
export type KeepAsTextRow = { mime: string; text_document_id?: string | null }

/** A text file (`.md`, `.txt`) whose words are not kept yet. A PDF, a picture or an `.eml` never qualifies: it is not text. */
export function legalDocumentCanKeepAsText(row: KeepAsTextRow): boolean {
  return legalDocumentIsText(row.mime) && !row.text_document_id
}

/** The rows on the matter the press would act on, in the order given. */
export function legalDocumentsToKeepAsText<T extends KeepAsTextRow>(rows: ReadonlyArray<T>): T[] {
  return rows.filter(legalDocumentCanKeepAsText)
}

export const KEEP_AS_TEXT_WORDS = {
  /** The line on a qualifying row's ⋯ menu. */
  menu: 'Keep its words as text',
  /** The row's record, in the menu's head: why the row has no Read yet. */
  record: 'Kept as a file only. Keep its words as text to read and copy them here.',
  /** The counted press's hover. */
  batchTip: 'Each is a text file kept only as a file. This keeps its words as text, so the row gets Read and the copy presses. The stored file stays.',
} as const

/** The counted press shows when more than one row qualifies; one row has its menu line. */
export function keepAsTextBatchShows(n: number): boolean {
  return n > 1
}

/** *Keep 3 as text*. */
export function keepAsTextBatchLabel(n: number): string {
  return `${countedLabel('Keep', n)} as text`
}

/** Why a stored file's words cannot be kept, or null: a file with no words, or more words than a text document keeps. */
export function keepAsTextProblem(words: string): string | null {
  if (words.trim() === '') return 'The stored file has no words to keep.'
  if (words.length > LEGAL_TEXT_DOCUMENT_MAX_CHARS) return `The text is longer than ${LEGAL_TEXT_DOCUMENT_MAX_CHARS.toLocaleString('en-US')} characters.`
  return null
}

/**
 * After the press: the toast (*Kept 2 papers as text. 1 did not keep.*), its tone, and the head over the papers that
 * did not take (*1 paper did not keep. It stays here with the reason.*), null when every one took.
 */
export function keepAsTextOutcome(done: number, failed: number): BatchOutcome {
  const said = batchOutcomeWords({ verb: 'keep', past: 'kept', done, failed, noun: ['paper as text', 'papers as text'] })
  return { ...said, head: batchOutcomeWords({ verb: 'keep', past: 'kept', done, failed, noun: 'paper' }).head }
}

/** A paper that did not take, as the list under the head names it: its title, then the reason. */
export type KeepAsTextFailure = { id: string; title: string; why: string }
