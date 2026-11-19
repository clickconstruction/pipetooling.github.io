/**
 * Where a filed lien's copies stand, and the two names every door to them reads (the owner's word of 2026-11-18).
 * He found *Mail this copy* confusing: "someone will see it after having already mailed a copy and not know if it
 * goes to a printout or if it is where they record their receipt of the mail". The same step also read *Mail the
 * copies*, *Mail 12 liens' copies*, *Record the service* and *Record service*, and none said which half it opened.
 *
 * So the step has two stages and one name each, the notices' own pair (`lienRunWords.ts`, Taunya's words of
 * 2026-11-16): **Print the copies to mail** until the copies are printed, then **Enter mail numbers**. A door reads
 * the name of its stage and lands on that half.
 *
 * A lien's copies count as printed once a print of them is filed on its job (`sent_documents`, kind
 * `lien_affidavit_copy`, read by `lienServePrintsIo.ts`), or once a mail number or a receipt is on the filing, which
 * says they went out whoever printed them. A lien the app did not draw (filed by counsel, or recorded by hand) has no
 * copy to print here: the office mails a photocopy, so its doors read **Enter mail numbers** from the start.
 *
 * Pure.
 */
import { countedLabel } from '../batchWords'
import { parseLienSends } from './lienSendTracking'

export type LienServeStage = 'print' | 'record'

/** The two names, the same on every door. */
export const LIEN_SERVE_STAGE_WORDS: Record<LienServeStage, string> = {
  print: 'Print the copies to mail',
  record: 'Enter mail numbers',
}

/** The filings whose copies were printed here, as a set, a list, or nothing when the read is not in. */
export type LienServePrinted = ReadonlySet<string> | ReadonlyArray<string> | null | undefined

function has(printed: LienServePrinted, id: string): boolean {
  if (!printed) return false
  return printed instanceof Set ? printed.has(id) : (printed as ReadonlyArray<string>).includes(id)
}

/** Whether the filing keeps the paper the app drew, which is what a copy is printed from (`lienServeHolds`'s *no_paper*). A filing handed in without its `fields` is not judged. */
function hasPaper(filing: { fields?: unknown }): boolean {
  if (!('fields' in filing)) return true
  const f = filing.fields as Record<string, unknown> | null | undefined
  if (!f || typeof f !== 'object') return false
  return ['ownerName', 'propertyAddress', 'unpaidAmount'].every((k) => typeof f[k] === 'string' && (f[k] as string).trim() !== '')
}

/** A filed lien's stage. With the read of the prints not in, a lien with nothing on its filing reads as still to print. */
export function lienServeStage(filing: { id: string; sends?: unknown; fields?: unknown }, printed: LienServePrinted): LienServeStage {
  if (has(printed, filing.id) || !hasPaper(filing)) return 'record'
  return parseLienSends(filing.sends).some((s) => (s.tracking ?? '').trim() || (s.receipt_url ?? '').trim()) ? 'record' : 'print'
}

/**
 * The Lien window's own form for the second half (v2.7816). It read **Record service…** and saved with **Record
 * service**, the statute's word, while every door on the desk read *Enter mail numbers*. The opener now reads as the
 * doors do, the day is *Mailed on* as in the copies window, and the save names its act as the notices' run does.
 * The toast after the save is `serviceSavedWords` (`lienServiceProof.ts`), which the dev seat's reply reads too.
 */
export const LIEN_SERVE_FORM_WORDS = {
  /** The press that opens the form, on the affidavit tab. */
  opener: `${LIEN_SERVE_STAGE_WORDS.record}…`,
  /** The form's title on a phone's sheet. */
  title: LIEN_SERVE_STAGE_WORDS.record,
  /** The day's label. */
  day: 'Mailed on',
  /** The save, while the day is not on record. Once it is, the save reads *Save the mail receipts*. */
  save: 'Record the mailing',
  failed: 'Could not record the mailing.',
} as const

/** The form's heading on a computer: *Enter mail numbers for the filed copies (mail by November 23, 2026)*. */
export function lienServeFormHead(mailBy: string): string {
  const by = mailBy.trim()
  return `${LIEN_SERVE_STAGE_WORDS.record} for the filed copies${by ? ` (mail by ${by})` : ''}`
}

/** A door's words for one lien, with the chevron of a press that opens a window. */
export function lienServeStageDoor(stage: LienServeStage): string {
  return `${LIEN_SERVE_STAGE_WORDS[stage]} ›`
}

const COPIES: [string, string] = ['lien’s copies', 'liens’ copies']

/**
 * The door to *Filed liens: copies to mail* from the Board's bin and the list's folded row, which stands for every
 * lien in the bin at once. With none printed it reads *Print 9 liens' copies ›*. With every one printed it reads
 * *Enter mail numbers · 12 ›*. With some of each it names both halves and their counts, *Print 1 · Enter mail numbers
 * 10 ›*, so the office that mailed ten still finds its door while one waits to print. A held lien cannot print, is
 * mailed by photocopy and is recorded like the rest, so it counts with the numbers. Null with none.
 */
export function lienServeStageDoorWords(c: { toPrint: number; owed: number }): { label: string; stage: LienServeStage | 'both' } | null {
  if (c.owed <= 0) return null
  const toRecord = c.owed - c.toPrint
  if (c.toPrint > 0 && toRecord > 0) return { label: `Print ${c.toPrint} · ${LIEN_SERVE_STAGE_WORDS.record} ${toRecord} ›`, stage: 'both' }
  if (c.toPrint > 0) return { label: `${countedLabel('Print', c.toPrint, COPIES)} ›`, stage: 'print' }
  return { label: `${LIEN_SERVE_STAGE_WORDS.record} · ${c.owed} ›`, stage: 'record' }
}

/** The counts that door reads, from the plan's two lists: a held lien cannot print, so it never keeps the door on print. */
export function lienServeStageCounts(plan: { ready: ReadonlyArray<{ job: { filing: { id: string; sends?: unknown } } }>; held: ReadonlyArray<unknown> }, printed: LienServePrinted): { toPrint: number; owed: number } {
  return { toPrint: plan.ready.filter((r) => lienServeStage(r.job.filing, printed) === 'print').length, owed: plan.ready.length + plan.held.length }
}

/**
 * Where a door lands in *Filed liens: copies to mail*: the print half, the numbers half, one lien's row in it (its
 * *Mailed* box under the cursor), or one copy's line. The selectors live here so the window's markup and the landing
 * cannot drift.
 */
export type LienServeLanding = { part: 'print' } | { part: 'numbers'; jobId?: string; recipient?: 'owner' | 'original_contractor'; /** Put the cursor in the copy's number box. */ cursor?: boolean; /** Land on the lien's whole row, the cursor on its *Mailed* box. */ tick?: boolean }

/** What the landing puts the cursor in: the lien's *Mailed* box, a copy's number box, or nothing. */
export function lienServeLandingFocus(land: LienServeLanding): string | null {
  if (land.part !== 'numbers') return null
  return land.tick ? 'input[type="checkbox"]' : land.cursor ? 'input[type="text"]' : null
}

export function lienServeLandingSelector(land: LienServeLanding): string {
  if (land.part === 'print') return '[data-lien-serve-print-part]'
  if (land.jobId && land.tick) return `[data-lien-serve-job="${land.jobId}"]`
  if (land.jobId) return `[data-lien-serve-job="${land.jobId}"] [data-lien-serve-envelope="${land.recipient ?? 'owner'}"]`
  return '[data-lien-serve-numbers-part] > h3'
}
