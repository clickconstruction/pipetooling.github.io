/**
 * What was mailed, kept with the notice (the owner's ask of 2026-11-16: "after we print we should have the user
 * upload what they are going to mail for easier reference later of what actually went out"; his pick, one file per
 * notice).
 *
 * After the packet prints and is signed, the office scans or photographs the papers that go in the envelope. On the
 * run's checklist a printed row takes the file: it goes into the job's own Drive folder, where the job's other sent
 * papers are (`putJobFolderFile(jobId, 'sent', …)`, the Documents tab's own call), and the notice remembers it in
 * `job_lien_desk_items.mailed_copies` until its mailing is recorded. The record then takes the first link as its
 * saved copy (`job_lien_filings.document_url`), so the Lien window shows it with no change there.
 *
 * Pure: the list's shape as stored, the file's name in Drive, the one reason a file is refused, the record's saved
 * copy, and every word a person reads. The upload and the write are `lienMailedCopiesIo.ts`.
 */
import { LIEN_SCAN_ACCEPT, lienScanExtension, lienScanProblem } from './lienScanFile'
import { TAKE_OFF_FILE_WORDS, type FileTakenOff } from './jobFolderTrash'

/** One file in the job's Drive folder, as the notice remembers it. */
export type LienMailedCopy = {
  /** The Drive link. */
  url: string
  driveFileId: string
  /** The file's name in Drive. */
  name: string
  /** When it was added, an ISO instant. */
  at: string
  /** Who added it, `users.id`; null when the row does not say. */
  by: string | null
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** The column as stored, read without trust: anything that is not a list of files with a link reads as none. */
export function parseLienMailedCopies(raw: unknown): LienMailedCopy[] {
  if (!Array.isArray(raw)) return []
  const out: LienMailedCopy[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const url = text(o.url)
    if (!/^https?:\/\//i.test(url)) continue
    out.push({ url, driveFileId: text(o.driveFileId), name: text(o.name) || 'the mailed copy', at: text(o.at), by: text(o.by) || null })
  }
  return out
}

/** The list with one more file, newest last. A file already on it (the same Drive file) is not listed twice. */
export function lienMailedCopiesWith(list: ReadonlyArray<LienMailedCopy>, copy: LienMailedCopy): LienMailedCopy[] {
  const rest = list.filter((c) => !(copy.driveFileId && c.driveFileId === copy.driveFileId))
  return [...rest, copy]
}

/** How the list tells one file from another: its Drive file, or its link on a row that has no id. */
export function lienMailedCopyKey(copy: Pick<LienMailedCopy, 'driveFileId' | 'url'>): string {
  return copy.driveFileId || copy.url
}

/** The list with one file taken off (v2.7525). Every other file keeps its place. */
export function lienMailedCopiesWithout(list: ReadonlyArray<LienMailedCopy>, copy: Pick<LienMailedCopy, 'driveFileId' | 'url'>): LienMailedCopy[] {
  const key = lienMailedCopyKey(copy)
  return list.filter((c) => lienMailedCopyKey(c) !== key)
}

/** The kinds of file the press takes: a scan or a photo. One rule with a filed affidavit's scan (`lienScanFile.ts`). */
export const LIEN_MAILED_COPY_ACCEPT = LIEN_SCAN_ACCEPT

/** Why a file cannot be added, in a sentence, or null when it can. The shared rule, naming the notice as the paper to scan alone. */
export function lienMailedCopyProblem(file: { size: number; type: string; name: string }): string | null {
  return lienScanProblem(file, 'notice')
}

/** Which paper the envelope holds: the monthly § 53.056 notice, or the § 53.057 retainage notice (v2.7525). */
export type LienMailedCopyPaper = 'notice' | 'retainage'

/**
 * The file's name in the job's Drive folder: *Lien notice as mailed · 1042 · 2026-11-16.pdf*, and *· 2* for a
 * second file the same day. A retainage notice's reads *Retainage notice as mailed*. A name that says what it is
 * can be found from the folder with no app open.
 */
export function lienMailedCopyName(input: { jobNumber: string; ymd: string; already: number; file: { type: string; name: string }; paper?: LienMailedCopyPaper }): string {
  const job = input.jobNumber.trim()
  const parts = [input.paper === 'retainage' ? 'Retainage notice as mailed' : 'Lien notice as mailed', job, input.ymd, input.already > 0 ? String(input.already + 1) : ''].filter(Boolean)
  return `${parts.join(' · ')}.${lienScanExtension(input.file)}`
}

/**
 * The record's saved copy for a notice with a mailed file. A link the office typed in the run wins, since they
 * chose it; otherwise the first mailed file is the link. The note names the files either way.
 */
export function lienMailedCopyDocument(copies: ReadonlyArray<LienMailedCopy>, typed: { url?: string | null; note?: string | null } = {}): { url?: string | null; note?: string | null } {
  if (copies.length === 0) return typed
  const typedUrl = (typed.url ?? '').trim()
  const typedNote = (typed.note ?? '').trim()
  const names = copies.map((c) => c.name).join(', ')
  const said = `What was mailed: ${names}`
  return { url: typedUrl || copies[0]!.url, note: typedNote ? `${typedNote} · ${said}` : said }
}

/** The words on the row. Each sentence is one idea, as a first-timer reads it (`plainWords.ts`). */
export const LIEN_MAILED_COPY_WORDS = {
  /** The press, on a printed row with no file yet. */
  add: 'Add what was mailed',
  /** The press once the row has a file. */
  another: 'Add another',
  adding: 'Adding…',
  open: 'Open in Drive',
  /** The hover on the press. */
  title: 'Scan or photograph the papers that go in this envelope, then add the file. It goes in the job’s Drive folder.',
  /** Under a row that is not printed yet. */
  printFirst: 'Print it first.',
  failed: 'The file could not be added. Nothing was saved.',
  /** Beside the reason of a file that did not go up, where a second try can get past it (v2.7635). */
  tryAgain: 'Try again',
  /** Beside a listed file (v2.7525): the press that takes it off this notice. */
  takeOff: 'Take off',
  /** The two answers to the ask. The first names the act. */
  takeOffConfirm: 'Take it off',
  keep: 'Keep it',
  takingOff: 'Taking it off…',
  takeOffFailed: 'The file could not be taken off. Nothing changed.',
} as const

/** The ask under the row before a file is taken off. It says what stays. */
export function lienMailedCopyTakeOffAsk(name: string): string {
  return `Take ${name} off this notice? ${TAKE_OFF_FILE_WORDS.askTail}`
}

/**
 * After the press: what changed, and where the file is now (v2.7699). With no outcome the link was not a Drive
 * file's, so nothing was asked of Drive and the words say only what the notice forgot.
 */
export function lienMailedCopyTakenOffWords(name: string, outcome?: FileTakenOff | null): string {
  const lead = `Took ${name} off this notice.`
  if (!outcome) return lead
  return outcome.where === 'trash' ? `${lead} The file is in Drive’s trash.` : `${lead} The file stays in Drive. ${outcome.why}`.trim()
}

/** After Put it back: the notice lists the file again. */
export function lienMailedCopyPutBackWords(name: string): string {
  return `Put ${name} back on this notice.`
}

/** After the press: where the file went. */
export function lienMailedCopyAddedWords(name: string): string {
  return `Added ${name}. It is in the job’s Drive folder, under Sent by us.`
}
