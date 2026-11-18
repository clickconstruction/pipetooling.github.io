/**
 * The print of each Board column (v2.7470, punch list #362; the owner's ask of 2026-11-16: *"Do you think
 * on the to do page we do a good enough job offering the user the tools to print batches?"*, and on the third drawing,
 * a print under each column: *"Yes, build this"*).
 *
 * To do offered the batch prints as doors. A GC's approved notices had a row that opened the run narrowed to that GC,
 * the whole run opened only from the Board's third tile or the title bar, and the affidavits' print was a door to By
 * paper's list. No row said how many could print now. So each column of the Board ends in its own print, where the
 * flow ends: under the notices, the whole run on every notice that can go; under the affidavits, the batch print
 * itself. One line under each says what the print leaves out, with the door to it. Scrolled into the list, the same
 * pair stands in short form beside the find box, left and right as the columns are.
 *
 * Since v2.7708 (the owner's pick of 2026-11-17: *Build B but with the action button in the same line as the title of
 * the card it is in*) each press stands on the title line of the bin it empties, and nothing stands between the tiles
 * and the chart. `bin` names that bin. A phone keeps its bins folded, so there the pair stands in one row over them.
 *
 * Pure: counts in, words out. The counts are the desk's own, the ones the run's door and By paper's print bar count
 * with, so the three cannot disagree. Every press names its act and its count (`countedLabel`), and is dead only when
 * nothing is ready. The notice press reads *Enter mail numbers* once every approved notice has printed, as the run's
 * own door does.
 */
import { countedLabel } from '../batchWords'

/** The bin a print empties, by the Board's own key: on a computer the press stands on that bin's title line. */
export type LienBoardPrintBin = 'notice:to_print' | 'notice:in_mail' | 'affidavit:ready'

export type LienBoardPrintSide = {
  kind: 'notice' | 'affidavit'
  /** The bin the press empties (the owner's pick of 2026-11-17): *Approved · to print*, *Approved · to mail* once every notice has printed, *Ready to file*. */
  bin: LienBoardPrintBin
  /** What the press does: opens the run on the packet, opens it on the mail numbers, or prints the affidavits here. */
  act: 'print_run' | 'record_run' | 'print_affidavits'
  /** The press's words, with its count: *Print and mail 8 notices*. */
  label: string
  /** Nothing can go now: the press is dead and the line under it says why. */
  dead: boolean
  /** The pair beside the find box: the press in as few words, and what it leaves, *7 wait*. */
  short: { label: string; left: string | null }
  /** What the press leaves out, and the words of the door to it; null when it leaves nothing. */
  left: { words: string; door: string } | null
  /** A quiet line under the press, with a door: what the affidavits print with, and *Change*. */
  note: { words: string; door: string } | null
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/**
 * Under the notices' column. `toPrint` is every approved notice not yet printed (retainage notices ride the same
 * run), `waits` how many of them still lack the leader's signature, `printed` the ones printed with mail numbers
 * still owed. Null when no approved notice is on the desk: the column ends with no press.
 */
export function lienBoardNoticePrint(c: { toPrint: number; waits: number; printed: number; leaderName?: string | null }): LienBoardPrintSide | null {
  const waits = Math.max(0, Math.min(c.waits, c.toPrint))
  const ready = c.toPrint - waits
  if (c.toPrint <= 0 && c.printed <= 0) return null
  const leader = (c.leaderName ?? '').trim() || 'the leader'
  const left = waits > 0 ? { words: `${waits} ${plural(waits, 'waits', 'wait')} on ${leader}’s signature`, door: plural(waits, 'See it', 'See them') } : null
  // Every approved notice has printed: the run is open on its mail numbers, as its own door says.
  if (c.toPrint <= 0) return { kind: 'notice', bin: 'notice:in_mail', act: 'record_run', label: `Enter mail numbers · ${c.printed}`, dead: false, short: { label: `Enter mail numbers · ${c.printed}`, left: null }, left: null, note: null }
  const label = countedLabel('Print and mail', ready, 'notice')
  return { kind: 'notice', bin: 'notice:to_print', act: 'print_run', label, dead: ready <= 0, short: { label, left: waits > 0 ? `${waits} ${plural(waits, 'waits', 'wait')}` : null }, left, note: null }
}

/**
 * The press on *Approved · to mail*'s title line while notices still wait to print: the run again, named for what that
 * bin owes. Null with nothing printed, and null once every notice has printed, when the notices' own press says it.
 */
export function lienBoardMailNumbersPress(c: { toPrint: number; printed: number }): { label: string } | null {
  if (c.printed <= 0 || c.toPrint <= 0) return null
  return { label: `Enter mail numbers · ${c.printed}` }
}

/**
 * Under the affidavits' column. `ready` is what the batch print takes (the desk's print plan: approved, on the short
 * form, every gate clear), `held` the approved papers a gate holds, `earlierForm` the approved papers on the earlier
 * form, which the batch leaves for their own Lien window. `with` names the pages that print in front of the stack, as
 * the office ticked them on By paper's print bar, where they are changed. Null when no approved affidavit is on the desk.
 */
export function lienBoardAffidavitPrint(c: { ready: number; held: number; earlierForm: number; with: ReadonlyArray<string>; shown?: boolean }): LienBoardPrintSide | null {
  const out = c.held + c.earlierForm
  if (c.ready <= 0 && out <= 0) return null
  // The print's own name, as By paper's bar says it (*Print 10 for notarization*): one act, one name.
  const label = `${countedLabel('Print', c.ready)}${c.shown && c.ready > 0 ? ' shown' : ''} for notarization`
  const parts = [c.held > 0 ? `${c.held} held on a property fact` : '', c.earlierForm > 0 ? `${c.earlierForm} on the earlier form` : ''].filter(Boolean)
  const left = parts.length ? { words: parts.join(' · '), door: plural(out, 'See it', 'See them') } : null
  const withWords = c.with.length === 0 ? 'Prints the affidavits alone' : `Prints with ${c.with.length <= 2 ? c.with.join(' and ') : `${c.with.slice(0, -1).join(', ')} and ${c.with[c.with.length - 1]}`}`
  return { kind: 'affidavit', bin: 'affidavit:ready', act: 'print_affidavits', label, dead: c.ready <= 0, short: { label, left: out > 0 ? `${out} held` : null }, left, note: c.ready > 0 ? { words: withWords, door: 'Change' } : null }
}
