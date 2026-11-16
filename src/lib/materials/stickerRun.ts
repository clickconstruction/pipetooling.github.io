/**
 * Print blank stickers (punch list #329, PR 2, v2.7272): the window's words, the run request's checks and what one
 * sticker prints, for a run of stickers minted before their boxes. A sticker is a code to scan and a number to read
 * (`stickers.ts`); `mint_sticker_run` inserts the run as the caller and its triggers number the block and make the
 * stickers (`20261113020000_box_stickers.sql`). The strip is the tape label's own: the QR of `HTTPS://PRTS.CO/B/<CODE>`,
 * the number where a box's stencil goes and the dashed address on two lines. Pure: the reads and the
 * mint are `stickerRunsIo.ts`, the window `PrintStickersModal.tsx`, the fold `StickerRunsFold.tsx`.
 */
import { countedLabel } from '../batchWords'
import { isOfficeRole } from '../doorRoles'
import { csvEscapeField } from '../bids/bidCsvExport'
import { BOX_LINK_HOST, BOX_LINK_SCHEME, dashedCode } from './labels'
import { stickerNumberWords, stickerRangeWords, stickerRunCounts, type StickerCountRow, type StickerRunCounts } from './stickers'
import { clampTapeCopies, TAPE_COPIES_MAX } from './tapeLabel'

/** The press on the job's On site strip and the Materials strip, and the window's title. */
export const PRINT_STICKERS_LABEL = 'Print blank stickers'

/** The quick presses for how many, as the card draws them; a typed number takes any count in range. */
export const STICKER_COUNT_PRESETS = [30, 60, 100, 200] as const
/** The table's own bounds: `sticker_count BETWEEN 1 AND 500`. */
export const STICKER_RUN_MIN = 1
export const STICKER_RUN_MAX = 500

/** A whole number from 1 to 500, or null for anything else (the press is dead and the line says the range). */
export function stickerCountOf(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : Number.NaN
  if (!Number.isInteger(n) || n < STICKER_RUN_MIN || n > STICKER_RUN_MAX) return null
  return n
}

/** The database's own words for a count out of range, so the screen and the trigger agree. */
export const STICKER_COUNT_RANGE_WORDS = 'A run is 1 to 500 stickers.'

// ---------------------------------------------------------------------------
// Who
// ---------------------------------------------------------------------------

/** The client's twin of `sticker_can_mint()`: the office (`is_office_staff`), a primary or a superintendent. */
export function canMintStickers(role: string | null | undefined): boolean {
  return isOfficeRole(role) || role === 'primary' || role === 'superintendent'
}

/** Why the press is dead for everyone else, in the trigger's own words. */
export const STICKER_MINT_WHO = 'Only the office, a primary or a superintendent prints a run of stickers.'

// ---------------------------------------------------------------------------
// The request
// ---------------------------------------------------------------------------

export type StickerRunRequest = { jobId: string; count: number; copies: number }

export type StickerRunVerdict = { ok: true; request: StickerRunRequest } | { ok: false; words: string }

/**
 * The checks the press makes before it asks the database, each in the words the database would answer with, so a
 * refusal reads the same from either side. The database judges again: these only keep a dead press honest.
 */
export function stickerRunRequest(input: { jobId: string | null | undefined; count: unknown; copies: unknown; role: string | null | undefined }): StickerRunVerdict {
  if (!canMintStickers(input.role)) return { ok: false, words: STICKER_MINT_WHO }
  if (!input.jobId) return { ok: false, words: 'A run names the job its new boxes go on.' }
  const count = stickerCountOf(input.count)
  if (count == null) return { ok: false, words: STICKER_COUNT_RANGE_WORDS }
  const copies = Math.floor(Number(input.copies))
  if (!Number.isFinite(copies) || copies < 1 || copies > TAPE_COPIES_MAX) return { ok: false, words: `Copies of each is 1 to ${TAPE_COPIES_MAX}.` }
  return { ok: true, request: { jobId: input.jobId, count, copies } }
}

/** The press: *Print 200 stickers*, or *Print 200 sets* when each prints more than once. Dead at zero (*Print stickers*). */
export function stickerRunPressLabel(count: number, copies: number): string {
  const n = Math.max(0, count)
  return clampTapeCopies(copies) > 1 ? countedLabel('Print', n, ['set', 'sets']) : countedLabel('Print', n, ['sticker', 'stickers'])
}

/** Under the title: *200 stickers, 2 strips each. 400 strips.* or *200 stickers, one strip each.* */
export function stickerRunCountWords(count: number, copies: number): string {
  const n = Math.max(0, count)
  const c = clampTapeCopies(copies)
  const stickers = `${n} ${n === 1 ? 'sticker' : 'stickers'}`
  if (c > 1) return `${stickers}, ${c} strips each. ${n * c} strips.`
  return `${stickers}, one strip each.`
}

/** Where the numbers start: *The last run ended at 0100.*, or that this is the first. The numbers themselves are given when the run is minted. */
export function lastRunWords(lastNumber: number | null): string {
  return lastNumber == null ? 'This is the first run. The numbers start at 0001.' : `The last run ended at ${stickerNumberWords(lastNumber)}.`
}

// ---------------------------------------------------------------------------
// The run as the database answers it
// ---------------------------------------------------------------------------

export type MintedSticker = {
  id: string
  number: number
  code: string
  /** The name printed large on the sticker, G78 (section 10, v2.7312); null on a sticker that carries its number only. Left out by a reader from before the names. */
  boxName?: string | null
}

export type StickerRun = {
  id: string
  /** Null once the job is deleted; the stickers stay good. */
  jobId: string | null
  count: number
  firstNumber: number
  lastNumber: number
  copies: number
  printedByName: string
  printedAt: string
  /** The run's box names in print order (section 10, v2.7312); null for a run of numbers only. Left out by a reader from before the names. */
  names?: string[] | null
}

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null
}

/** A `sticker_runs` row read back; null when it is not one (a run refused before its numbers has none and is never answered). */
export function stickerRunOf(raw: unknown): StickerRun | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = text(r.id)
  const count = typeof r.sticker_count === 'number' ? r.sticker_count : Number.NaN
  const first = typeof r.first_number === 'number' ? r.first_number : Number.NaN
  const last = typeof r.last_number === 'number' ? r.last_number : Number.NaN
  if (!id || !Number.isInteger(count) || count < 1 || !Number.isInteger(first) || !Number.isInteger(last) || last < first) return null
  // The names, when the row carries them and they are as many as the stickers; a short or odd list reads as none.
  const names = Array.isArray(r.names) && r.names.length === count && r.names.every((n) => typeof n === 'string' && n.trim()) ? (r.names as string[]) : null
  return {
    id,
    jobId: text(r.job_id),
    count,
    firstNumber: first,
    lastNumber: last,
    copies: clampTapeCopies(r.copies),
    printedByName: typeof r.printed_by_name === 'string' ? r.printed_by_name.trim() : '',
    printedAt: text(r.printed_at) ?? '',
    names,
  }
}

/** One `{ id, number, code }` of the mint's answer or a `box_stickers` row; null when it is not one. */
export function mintedStickerOf(raw: unknown): MintedSticker | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = text(r.id)
  const code = text(r.code)
  const number = typeof r.number === 'number' ? r.number : Number.NaN
  if (!id || !code || !Number.isInteger(number) || number < 1) return null
  return { id, number, code: code.toUpperCase(), boxName: text(r.box_name)?.toUpperCase() ?? null }
}

export type MintedRun = { run: StickerRun; stickers: MintedSticker[] }

/** `mint_sticker_run`'s answer, `{ run, stickers }`, read back in number order; null when it is not a whole run. */
export function mintedRunOf(raw: unknown): MintedRun | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const run = stickerRunOf(r.run)
  if (!run || !Array.isArray(r.stickers)) return null
  const stickers = r.stickers.map(mintedStickerOf).filter((s): s is MintedSticker => s != null).sort((a, b) => a.number - b.number)
  if (stickers.length !== run.count) return null
  return { run, stickers }
}

// ---------------------------------------------------------------------------
// What one sticker prints
// ---------------------------------------------------------------------------

/** One strip's content, in the tape label's shape: the number where a box's stencil goes. */
export type StickerStrip = {
  id: string
  /** Large: the number as printed, `0147`. */
  stencil: string
  /** Under it, on two lines: `PRTS.CO/B/` and `4F2A-9C18`. */
  address: string
  /** What the QR carries: `HTTPS://PRTS.CO/B/4F2A9C18`. */
  value: string
  /** A line of words under the address; the test strip alone has one. */
  words?: string
}

/** The address the QR carries for a code, as `boxUrl` builds a box's: the scheme, the short host and the code, in capitals. */
export function stickerUrl(code: string): string {
  return `${BOX_LINK_SCHEME}${BOX_LINK_HOST}/b/${code}`.toUpperCase()
}

/** The address as it prints under the number: `PRTS.CO/B/4F2A-9C18`. */
export function stickerAddressWords(code: string): string {
  return `${BOX_LINK_HOST}/b/${dashedCode(code)}`.toUpperCase()
}

export function stickerStrip(s: MintedSticker): StickerStrip {
  return { id: s.id, stencil: stickerNumberWords(s.number), address: stickerAddressWords(s.code), value: stickerUrl(s.code) }
}

/**
 * The test strip before a run: no sticker is minted for it. Its QR carries the bare address, which lands on Scan a
 * label, so a scan of it opens something and nothing it opens is a box.
 */
export const STICKER_TEST_STRIP: StickerStrip = { id: 'test-strip', stencil: '0000', address: `${BOX_LINK_HOST}/b`.toUpperCase(), value: `${BOX_LINK_SCHEME}${BOX_LINK_HOST}/b`.toUpperCase(), words: 'Test strip' }

// ---------------------------------------------------------------------------
// A run's words
// ---------------------------------------------------------------------------

/** *Run of 200 sets · 0101 to 0300*, or *Run of 200 · 0101 to 0300* with one strip each. */
export function stickerRunTitle(run: Pick<StickerRun, 'count' | 'firstNumber' | 'lastNumber' | 'copies'>): string {
  const of = run.copies > 1 ? `Run of ${run.count} sets` : `Run of ${run.count}`
  return `${of} · ${stickerRangeWords(run.firstNumber, run.lastNumber)}`
}

/** *Printed Nov 12 by Dana · 2 of each*. `day` is the printed day as words; the name is left out when the database kept none. */
export function stickerRunByLine(run: Pick<StickerRun, 'printedByName' | 'copies'>, day: string): string {
  const who = run.printedByName ? ` by ${run.printedByName}` : ''
  const copies = run.copies > 1 ? ` · ${run.copies} of each` : ''
  return `Printed ${day}${who}${copies}`
}

/** The fold's summary: *1 run of stickers*, *3 runs of stickers*. */
export function runsFoldWords(n: number): string {
  return n === 1 ? '1 run of stickers' : `${n} runs of stickers`
}

/** The fold's press that prints a whole run again: *Reprint 200 stickers*. */
export function reprintLabel(count: number): string {
  return countedLabel('Reprint', count, ['sticker', 'stickers'])
}

/**
 * The press that prints the stickers not yet on paper or not yet on a box: *Print the rest, 0163 to 0300* when they
 * are one unbroken block, *Print the rest, 96 stickers* when they are not, and *Print the rest* dead when there are none.
 */
export function printRestLabel(rest: ReadonlyArray<Pick<MintedSticker, 'number'>>): string {
  if (rest.length === 0) return 'Print the rest'
  const numbers = rest.map((s) => s.number).sort((a, b) => a - b)
  const first = numbers[0]!
  const last = numbers[numbers.length - 1]!
  if (last - first + 1 === numbers.length) return `Print the rest, ${stickerRangeWords(first, last)}`
  return `Print the rest, ${numbers.length} stickers`
}

/** A run's rows as the fold reads them: the sticker, the box it is on and whether it was lost. */
export type StickerRowOfRun = MintedSticker & StickerCountRow

/** The stickers of a run still blank, lowest first: what *Print the rest* prints. */
export function blankStickersOf(stickers: ReadonlyArray<StickerRowOfRun>): StickerRowOfRun[] {
  return stickers.filter((s) => !s.containerId && !s.lostAt).sort((a, b) => a.number - b.number)
}

/** A run's counts, from its rows. */
export function runCountsOf(stickers: ReadonlyArray<StickerRowOfRun>): StickerRunCounts {
  return stickerRunCounts(stickers)
}

// ---------------------------------------------------------------------------
// The print itself
// ---------------------------------------------------------------------------

/**
 * The stickers whose every strip has gone, from how many strips the printer took. With copies a sticker's strips go
 * together, 1 1 2 2, so a run stopped after three strips has printed one sticker whole and half of the second: the
 * second is in the rest.
 */
export function stickersPrintedWhole(doneStrips: number, copies: number): number {
  return Math.max(0, Math.floor(doneStrips / clampTapeCopies(copies)))
}

/** The stickers of a run still to print after a stop, in the order they were going. */
export function restAfterStop<T>(stickers: ReadonlyArray<T>, doneStrips: number, copies: number): T[] {
  return stickers.slice(stickersPrintedWhole(doneStrips, copies))
}

/** After a run: *200 stickers printed.*, or how many went before the printer stopped, with its reason. */
export function stickersSentWords(doneStrips: number, totalStickers: number, copies: number, reason?: string): string {
  const whole = Math.min(totalStickers, stickersPrintedWhole(doneStrips, copies))
  const noun = (n: number) => (n === 1 ? 'sticker' : 'stickers')
  if (!reason) return `${whole} ${noun(whole)} printed.`
  return `${whole} of ${totalStickers} ${noun(totalStickers)} printed, then the printer stopped: ${reason}`
}

/** After **Stop printing**: how many stickers went whole before the run was stopped. The press then prints the rest. */
export function stickersStoppedWords(doneStrips: number, totalStickers: number, copies: number): string {
  const whole = Math.min(totalStickers, stickersPrintedWhole(doneStrips, copies))
  return `${whole} of ${totalStickers} ${totalStickers === 1 ? 'sticker' : 'stickers'} printed, then you stopped the run.`
}

/** The window's line on what the press will print, by stage: the ask, or a minted run's range. */
export function runStripsWords(run: Pick<StickerRun, 'count' | 'copies' | 'firstNumber' | 'lastNumber'>, printing: number): string {
  const head = printing === run.count ? stickerRangeWords(run.firstNumber, run.lastNumber) : `${printing} of ${stickerRangeWords(run.firstNumber, run.lastNumber)}`
  return run.copies > 1 ? `${head}, ${run.copies} strips each. ${printing * run.copies} strips.` : `${head}, one strip each.`
}

/** The press on a minted run: *Print 200 sets, 0101 to 0300*. */
export function printRunLabel(stickers: ReadonlyArray<Pick<MintedSticker, 'number'>>, copies: number): string {
  const n = stickers.length
  if (n === 0) return stickerRunPressLabel(0, copies)
  const numbers = stickers.map((s) => s.number)
  const first = Math.min(...numbers)
  const last = Math.max(...numbers)
  const whole = last - first + 1 === n
  const range = whole ? `, ${stickerRangeWords(first, last)}` : ''
  return `${stickerRunPressLabel(n, copies)}${range}`
}

/** The fallback when the database's refusal has no words of its own: nothing was minted and nothing printed. */
export const STICKER_MINT_FAILED = 'The run was not made. No sticker was printed.'

/** Said while the window waits for the database to number the run. */
export const STICKER_MINTING = 'Numbering the run…'

// ---------------------------------------------------------------------------
// The CSV
// ---------------------------------------------------------------------------

export const STICKERS_CSV_COLUMNS = ['Number', 'Code', 'Address', 'QR'] as const

/** The run's stickers for Brother's P-touch Editor, as the labels window exports its boxes: the number, the dashed code, the address a person types and what the QR carries. */
export function stickersCsvText(stickers: ReadonlyArray<MintedSticker>): string {
  const head = STICKERS_CSV_COLUMNS.map(csvEscapeField).join(',')
  const body = [...stickers]
    .sort((a, b) => a.number - b.number)
    .map((s) => [stickerNumberWords(s.number), dashedCode(s.code), `${BOX_LINK_HOST}/b/${dashedCode(s.code)}`, stickerUrl(s.code)].map(csvEscapeField).join(','))
  return [head, ...body].join('\r\n') + '\r\n'
}

/** `stickers-0101-0300-2026-11-14.csv`. */
export function stickersCsvFileName(run: Pick<StickerRun, 'firstNumber' | 'lastNumber'>, ymd: string): string {
  return `stickers-${stickerNumberWords(run.firstNumber)}-${stickerNumberWords(run.lastNumber)}-${ymd}.csv`
}

/** The guide the window links to, and the heading. */
export const STICKERS_GUIDE = 'see-what-is-on-every-job-site-and-what-walked-away'
export const STICKERS_GUIDE_HEADING = 'Print blank stickers'
