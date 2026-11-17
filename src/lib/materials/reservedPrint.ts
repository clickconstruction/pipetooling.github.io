/**
 * Print the reserved stickers (punch list #329, v2.7523; the owner's word of 2026-11-16: *I can see stickers that were
 * reserved, but I don't see any tools to print them*). A job's screens named its reserved stickers and offered no way
 * to print them: the only way was the Runs fold, two presses away on another screen. This is the press that sits on
 * the reserved line itself, one for each run that still holds reserved stickers.
 *
 * It mints nothing. A run is made at the press of Print future stickers, whether or not a strip ever came out of the
 * printer. So the press prints the stickers the run already holds, each with the link it was given, and only those
 * on no box yet: the window it opens reaches the rest of the run through its own *From* and *to*. Pure: the runs in,
 * the presses and their words out. The window is `PrintStickersModal.tsx`.
 *
 * Since v2.7567 (punch list #373) a sticker keeps when its strips came out (`stickerMark.ts`), so a run whose reserved
 * stickers are part printed has a second press before the first, *Print the 18 not printed yet, G133 to G150*: what
 * *Print the rest* means once the window that stopped has been closed.
 */
import { countedLabel } from '../batchWords'
import { notPrintedTitle, printNotPrintedLabel, waitingStickersOf } from './stickerMark'
import { namesSpanWords } from './stickerNames'
import { blankStickersOf, PRINT_STICKERS_LABEL, stickerRunByLine, type MintedSticker, type StickerRowOfRun, type StickerRun } from './stickerRun'

/** One run that still holds reserved stickers, as its press prints them. */
export type ReservedRunPrint = {
  run: StickerRun
  /** Every sticker of the run, in number order: what the window's *From* and *to* can reach. */
  whole: MintedSticker[]
  /** The run's stickers on no box and not lost, in number order: what the press prints. */
  reserved: MintedSticker[]
  /** *G93 to G150*: the reserved names, when every one has a name. Empty for stickers with no names. */
  span: string
  /** The press: *Print the 58 reserved stickers, G93 to G150*. */
  label: string
  /** The window's title: *Reserved stickers, G93 to G150*. */
  title: string
  /**
   * The reserved stickers that have not printed yet, when they are some of the reserved ones and not all (punch list
   * #373): what the second press prints. Empty when none printed, where the first press prints the same stickers, when
   * all did, and for a run the app was not watching.
   */
  waiting: MintedSticker[]
  /** That press: *Print the 18 not printed yet, G133 to G150*. Empty with no such press. */
  waitingLabel: string
  /** Its window's title: *Not printed yet, G133 to G150*. Empty with no such press. */
  waitingTitle: string
}

const plain = ({ id, number, code, boxName, printedAt }: StickerRowOfRun | MintedSticker): MintedSticker => ({ id, number, code, boxName: boxName ?? null, ...(printedAt ? { printedAt } : {}) })

/** The reserved stickers' names in words, by the run's own order; empty when any has no name. */
function reservedSpan(reserved: ReadonlyArray<MintedSticker>, run: Pick<StickerRun, 'names'>): string {
  if (reserved.length === 0 || !reserved.every((s) => s.boxName)) return ''
  const names = reserved.map((s) => s.boxName as string)
  return namesSpanWords(names, run.names ?? names)
}

/**
 * The press's words: *Print the 58 reserved stickers, G93 to G150*, one sticker *Print the 1 reserved sticker, G93*,
 * stickers with no names by their count alone. It says *reserved*, the line's own word, and never *again*: nobody
 * knows whether the first print came out. At none it reads *Print the reserved stickers*, and the site makes it dead.
 */
export function printReservedLabel(count: number, span = ''): string {
  const head = countedLabel('Print the', count, ['reserved sticker', 'reserved stickers'])
  return count > 0 && span ? `${head}, ${span}` : head
}

/** The window's title on such a run: *Reserved stickers, G93 to G150*, or *30 reserved stickers* with no names. */
export function reservedRunTitle(count: number, span = ''): string {
  if (span) return count === 1 ? `Reserved sticker ${span}` : `Reserved stickers, ${span}`
  return count === 1 ? '1 reserved sticker' : `${count} reserved stickers`
}

/**
 * Each run of a job that still holds reserved stickers, the lowest names first, with its press. A run whose stickers
 * are all on boxes or lost has none and is left out: its whole run prints from the Runs fold's **Reprint**.
 */
export function reservedRunsToPrint(runs: ReadonlyArray<{ run: StickerRun; stickers: ReadonlyArray<StickerRowOfRun> }>): ReservedRunPrint[] {
  return runs
    .map(({ run, stickers }) => {
      const reserved = blankStickersOf(stickers).map(plain)
      const span = reservedSpan(reserved, run)
      const notPrinted = waitingStickersOf(run, stickers).map(plain)
      // Its own press only when it prints fewer stickers than the press beside it.
      const waiting = notPrinted.length > 0 && notPrinted.length < reserved.length ? notPrinted : []
      const waitingSpan = reservedSpan(waiting, run)
      return {
        run,
        whole: [...stickers].sort((a, b) => a.number - b.number).map(plain),
        reserved,
        span,
        label: printReservedLabel(reserved.length, span),
        title: reservedRunTitle(reserved.length, span),
        waiting,
        waitingLabel: waiting.length > 0 ? printNotPrintedLabel(waiting.length, waitingSpan) : '',
        waitingTitle: waiting.length > 0 ? notPrintedTitle(waiting.length, waitingSpan) : '',
      }
    })
    .filter((r) => r.reserved.length > 0)
    .sort((a, b) => a.run.firstNumber - b.run.firstNumber)
}

/** A press's run as the stickers window takes it (`StickerRunToPrint`): the whole run, the stickers it opens on, and whether this is their first print. */
export type ReservedRunToOpen = { run: StickerRun; stickers: MintedSticker[]; printing: MintedSticker[]; title: string; first?: boolean }

/** The press as the window takes it: the whole run, open on its reserved stickers. */
export function reservedRunToPrint(r: ReservedRunPrint): ReservedRunToOpen {
  return { run: r.run, stickers: r.whole, printing: r.reserved, title: r.title }
}

/** The second press as the window takes it: the whole run, open on the stickers that have not printed yet, and said as a first print. */
export function notPrintedRunToPrint(r: ReservedRunPrint): ReservedRunToOpen {
  return { run: r.run, stickers: r.whole, printing: r.waiting, title: r.waitingTitle, first: true }
}

/**
 * Beside a press when the job has more than one such run, so two runs with no names can be told apart: *Reserved Nov
 * 16 by Dana*. Empty with one run, whose line already says it. `dayWords` turns the run's day into words.
 */
export function reservedRunByLine(of: ReservedRunPrint, all: ReadonlyArray<ReservedRunPrint>, dayWords: (iso: string) => string): string {
  if (all.length < 2 || !of.run.printedAt) return ''
  return stickerRunByLine(of.run, dayWords(of.run.printedAt))
}

/** Under the press, so nobody reads it as a new reservation. */
export const PRINT_RESERVED_SAME_WORDS = 'This prints the same stickers with the same links. It reserves nothing new.'

/** In the window opened on a run already made, the fold's **Reprint** and **Print the rest** included. */
export const PRINT_RUN_AGAIN_WORDS = 'Printing them again reserves nothing new. Each sticker keeps the link it has.'

/** The same, in the window opened on the stickers that have not printed yet: nothing there prints *again*. */
export const PRINT_RUN_FIRST_WORDS = 'Printing them reserves nothing new. Each sticker keeps the link it has.'

/**
 * Said once a run stops part way, by **Stop printing** or by the printer: the rest are not lost with the window. The
 * way back is the press this file makes, on the job's reserved line.
 */
export function restKeptWords(left: number): string {
  if (left <= 0) return ''
  const head = left === 1 ? 'The 1 sticker left is still reserved.' : `The ${left} stickers left are still reserved.`
  return `${head} Print ${left === 1 ? 'it' : 'them'} now, or later from the job’s reserved line.`
}

/**
 * Before the other press on a card that has reserved stickers, so the two are told apart: **Print future stickers**
 * reserves new ones. With the name a new run opens on it says that too; empty when the job has none reserved, where
 * the card's own line stands as it was.
 */
export function newRunBesideReservedWords(nextName: string | null | undefined): string {
  const head = `${PRINT_STICKERS_LABEL} reserves new ones.`
  return nextName ? `${head} A new run opens on ${nextName}.` : head
}
