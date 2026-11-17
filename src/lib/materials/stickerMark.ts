/**
 * The printed mark on a sticker (punch list #373, v2.7567; the owner's words of 2026-11-16: *add Recording that a
 * run's strips came out*). A run of stickers is reserved at the press, before any strip leaves the printer, and
 * `sticker_runs.printed_at` is the moment the run was made. So a run that never printed read the same as one that
 * did. `box_stickers.printed_at` (`20261117140000_sticker_printed.sql`) is when a sticker's strips last came out: the
 * last copy leaving the P-touch, or the print window closing on it. The twin of a box's own mark, `labelMark.ts`.
 *
 * A sticker made before the mark began reads unmarked whether or not it printed, and nothing can tell the two apart.
 * So a sticker with no mark counts as *not printed yet* only where the app has been keeping the record for its run:
 * the run was made since the mark began, or one of its stickers carries a mark, which means the app has seen that
 * run print. Nothing is said about the stickers of an older run until one of them prints. Pure: the runs and the
 * print in, the counts, the ids and the words out.
 */
import { countedLabel } from '../batchWords'
import { stickersPrintedWhole } from './stickerRun'

/** When the app began keeping the mark: midnight of 2026-11-17 in the app's time zone. No run made earlier is watched until it prints. */
export const STICKER_MARK_SINCE = '2026-11-17T06:00:00Z'
const SINCE_MS = Date.parse(STICKER_MARK_SINCE)

/** A sticker as the mark reads it: where it is, and when its strips last came out. */
export type MarkSticker = { number: number; containerId: string | null; lostAt: string | null; printedAt?: string | null }
/** A run as the mark reads it: `printedAt` is when the run was made, the database's own name for it. */
export type MarkRun = { printedAt?: string }
type RunOfStickers<T extends MarkSticker = MarkSticker> = { run: MarkRun; stickers: ReadonlyArray<T> }

/** The app saw this sticker's strips come out. */
export function stickerPrinted(s: Pick<MarkSticker, 'printedAt'>): boolean {
  return typeof s.printedAt === 'string' && s.printedAt !== ''
}

/**
 * The app has been keeping the record for this run: it was made since the mark began, or one of its stickers carries
 * a mark. A run with no readable day and no mark is not watched.
 */
export function runKeepsMark(run: MarkRun, stickers: ReadonlyArray<Pick<MarkSticker, 'printedAt'>>): boolean {
  const made = Date.parse(run.printedAt ?? '')
  if (Number.isFinite(made) && made >= SINCE_MS) return true
  return stickers.some(stickerPrinted)
}

const isReserved = (s: MarkSticker) => !s.containerId && !s.lostAt

/** Reserved stickers by the mark: seen to print, not printed yet, and those of a run the app was not watching. */
export type ReservedMark = { printed: number; waiting: number; unknown: number }

export const NO_MARK: ReservedMark = { printed: 0, waiting: 0, unknown: 0 }

/** The reserved stickers of some runs, on no box and not lost, counted by the mark. */
export function reservedMarkOf(runs: ReadonlyArray<RunOfStickers>): ReservedMark {
  let printed = 0
  let waiting = 0
  let unknown = 0
  for (const { run, stickers } of runs) {
    const watched = runKeepsMark(run, stickers)
    for (const s of stickers) {
      if (!isReserved(s)) continue
      if (stickerPrinted(s)) printed += 1
      else if (watched) waiting += 1
      else unknown += 1
    }
  }
  return printed + waiting + unknown === 0 ? NO_MARK : { printed, waiting, unknown }
}

/** A run's reserved stickers that have not printed yet, lowest first. None for a run the app was not watching. */
export function waitingStickersOf<T extends MarkSticker>(run: MarkRun, stickers: ReadonlyArray<T>): T[] {
  if (!runKeepsMark(run, stickers)) return []
  return stickers.filter((s) => isReserved(s) && !stickerPrinted(s)).sort((a, b) => a.number - b.number)
}

/**
 * After the count of reserved stickers: *None printed yet.*, *40 printed, 18 not printed yet.* or *All printed.*
 * Stickers of a run the app was not watching are left out of the sentence: with some of those beside, it reads *18
 * not printed yet.* or *40 printed.*, and with nothing known it is empty.
 */
export function markCountsWords(m: ReservedMark): string {
  if (m.waiting > 0 && m.printed > 0) return `${m.printed} printed, ${m.waiting} not printed yet.`
  if (m.waiting > 0) return m.unknown > 0 ? `${m.waiting} not printed yet.` : 'None printed yet.'
  if (m.printed > 0) return m.unknown > 0 ? `${m.printed} printed.` : 'All printed.'
  return ''
}

/**
 * The stickers whose every strip went, of a run sent strip by strip, by their ids: with copies a sticker's strips go
 * together, so a sticker counts once the last of its copies is among the first `doneStrips`. One part way through its
 * copies does not count. `printing` is the stickers in the order they were going.
 */
export function stickersWhoseStripsWent(printing: ReadonlyArray<{ id: string }>, doneStrips: number, copies: number): string[] {
  return printing.slice(0, stickersPrintedWhole(doneStrips, copies)).map((s) => s.id)
}

/** Of the stickers just marked, the ones that had no mark before: what the line counts and what its press takes back. */
export function newlyMarkedStickerIds(ids: ReadonlyArray<string>, alreadyMarked: ReadonlySet<string>): string[] {
  return ids.filter((id) => !alreadyMarked.has(id))
}

const NOUN = ['sticker', 'stickers'] as const

/** *58 stickers are now marked as printed.*: after the print window closes, since the app cannot see the tape. */
export function stickersMarkedWords(n: number): string {
  return n === 1 ? '1 sticker is now marked as printed.' : `${n} stickers are now marked as printed.`
}

/** *The mark is off 58 stickers.* */
export function stickersUnmarkedWords(n: number): string {
  return n === 1 ? 'The mark is off 1 sticker.' : `The mark is off ${n} stickers.`
}

/** The question before the press that takes a mark back. */
export function didNotPrintAsk(n: number): string {
  return n === 1 ? 'Did it not print?' : 'Did they not print?'
}

/** *Take the mark off 58 stickers*: the press under a print window that printed nothing after all. */
export function takeStickerMarkOffLabel(n: number): string {
  return countedLabel('Take the mark off', n, NOUN)
}

/**
 * The press that prints only what never came out: *Print the 18 not printed yet, G133 to G150*, stickers with no
 * names by their count alone. At none it reads *Print the not printed yet*, and the site draws no such press.
 */
export function printNotPrintedLabel(count: number, span = ''): string {
  const head = countedLabel('Print the', count, ['not printed yet', 'not printed yet'])
  return count > 0 && span ? `${head}, ${span}` : head
}

/** The window's title on those stickers: *Not printed yet, G133 to G150*, or *18 stickers not printed yet*. */
export function notPrintedTitle(count: number, span = ''): string {
  if (span) return `Not printed yet, ${span}`
  return count === 1 ? '1 sticker not printed yet' : `${count} stickers not printed yet`
}

/** What went wrong when the mark could not be written: the caller's sentence for `formatErrorMessage`, which adds the reason after it. */
export const MARK_NOT_KEPT = 'The app did not record that these printed.'

/**
 * A quiet line when the mark could not be written: the print itself stands, and the line says why the record does
 * not. `said` is the failure as `formatErrorMessage(e, MARK_NOT_KEPT)` words it, which leads with the sentence above
 * for a refusal and stands alone for a lost signal; the sentence is put first where it is missing.
 */
export function markNotKeptWords(said: string): string {
  const s = said.trim()
  if (!s) return MARK_NOT_KEPT
  return s.startsWith(MARK_NOT_KEPT.slice(0, -1)) ? s : `${MARK_NOT_KEPT} ${s}`
}
