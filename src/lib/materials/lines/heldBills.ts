/**
 * Supply house bill lines, the bills that need a person (punch list #298 PR 3, v2.7110). Pure. The sweep reads every
 * bill with a PDF by itself; what it cannot give lines to, or what does not add up, waits. This file says where the
 * whole set stands and lists what waits, each with its reason and its door, for the window on the Supply houses tab.
 *
 * Three kinds of bill wait:
 *   * a paper that is off (`supply_papers.check_state`): its total is not the amount typed on the bill, or its lines
 *     do not add up. The door is Look;
 *   * a hold (`supply_bill_holds`): the app cannot open the file, the bill's number is not in its file, the file is
 *     a statement. The door is the bill itself, where its link and its number are;
 *   * a bill with no PDF at all, which has nothing to read.
 *
 * The reads are `heldBillsIo.ts`; the window is `BillLinesHeldWindow.tsx`.
 */
import { fileIdOfLink, HOLD_WORDS, type HoldWhy } from './billSweep'

/** Why a bill waits. The first two are a paper that is off; the last is a bill with nothing to read; the rest are the sweep's holds. */
export type HeldReason = 'row_amount' | 'sums' | Exclude<HoldWhy, 'reading'> | 'no_pdf'

/** What a person presses on a waiting bill: Look at its paper, or open the bill to fix its link, number or amount. */
export type HeldPress = 'look' | 'bill'

export interface HeldInvoice {
  id: string
  supplyHouseId: string | null
  number: string
  /** YYYY-MM-DD. */
  dateYmd: string
  amountCents: number
  link: string | null
}

export interface HeldPaper {
  id: string
  invoiceId: string
  checkState: 'adds_up' | 'off' | 'accepted'
  checkNote: string
}

export interface HeldHold {
  invoiceId: string
  why: HoldWhy
  note: string
}

export interface HeldBill {
  invoiceId: string
  houseId: string | null
  houseName: string
  number: string
  dateYmd: string
  amountCents: number
  link: string | null
  /** The gap in words, or what the sweep found in the file. */
  note: string
  /** The bill's paper when it has one, for Look. */
  paperId: string | null
}

export interface HeldGroup {
  reason: HeldReason
  /** Why these bills wait, one sentence. */
  words: string
  /** What opens it, one sentence. */
  door: string
  /** The presses a bill of this group offers, the first one first. None: nothing for a person to do. */
  presses: HeldPress[]
  bills: HeldBill[]
}

/** Where every bill on file stands. */
export interface LinesStanding {
  bills: number
  /** Bills with lines read. */
  read: number
  /** Of those: adding up, or counted as read by a person. */
  addUp: number
  /** Of those: off, waiting for a person. */
  off: number
  /** Bills the sweep holds, any reason. */
  held: number
  noPdf: number
  /** Bills with a PDF the sweep has not read yet; it reads them by itself. */
  toRead: number
  /** Bills a person can open and fix: the off ones, and the held ones that have a door. */
  needPerson: number
}

type GroupWords = { reason: HeldReason; words: string; door: string; presses: HeldPress[] }

/**
 * Each reason with its door, in the order the window lists them: what a person can fix first, then what waits by
 * itself, then the bills with nothing to read. A hold's sentence is the sweep's own (`HOLD_WORDS`).
 */
export const HELD_GROUPS: readonly GroupWords[] = [
  { reason: 'row_amount', words: 'The paper’s total is not the amount typed on the bill.', door: 'Look at the paper. Then fix the amount or the link on the bill.', presses: ['look', 'bill'] },
  { reason: 'sums', words: 'The lines read do not add up to the paper.', door: 'Look, to fix a line or count it as read.', presses: ['look'] },
  { reason: 'number_not_in_file', words: HOLD_WORDS.number_not_in_file.words, door: 'Open the bill, to fix its link or its number.', presses: ['bill'] },
  { reason: 'cannot_open', words: HOLD_WORDS.cannot_open.words, door: HOLD_WORDS.cannot_open.door, presses: ['bill'] },
  { reason: 'link', words: HOLD_WORDS.link.words, door: HOLD_WORDS.link.door, presses: ['bill'] },
  { reason: 'not_readable', words: HOLD_WORDS.not_readable.words, door: HOLD_WORDS.not_readable.door, presses: ['bill'] },
  { reason: 'too_big', words: HOLD_WORDS.too_big.words, door: HOLD_WORDS.too_big.door, presses: ['bill'] },
  { reason: 'not_a_bill', words: HOLD_WORDS.not_a_bill.words, door: 'Open the bill, to fix its link.', presses: ['bill'] },
  { reason: 'refused', words: HOLD_WORDS.refused.words, door: 'Nothing to do yet. It is tried again a day on.', presses: [] },
  { reason: 'cut', words: HOLD_WORDS.cut.words, door: 'Nothing to do yet. It is tried again a day on.', presses: [] },
  { reason: 'failed', words: HOLD_WORDS.failed.words, door: HOLD_WORDS.failed.door, presses: [] },
  { reason: 'statement', words: HOLD_WORDS.statement.words, door: HOLD_WORDS.statement.door, presses: [] },
  { reason: 'no_pdf', words: 'The bill has no PDF, so there is nothing to read.', door: 'Open the bill, to add the link to its PDF.', presses: ['bill'] },
]

/** An off paper's note that says its total is not the bill's amount (`checkPaper`'s `total_vs_row`, and `supply_paper_save`'s same words). */
export function noteIsRowAmount(note: string): boolean {
  return /^The printed total is .+ the amount on the bill/.test(note.trim())
}

/**
 * Where the set stands and what waits, from four reads: every bill, the papers on bills, the holds, the houses'
 * names. A bill with a paper is read, whatever hold an older run left. A bill with no paper waits under its hold; a
 * link that is no Drive file is held as that before the sweep says so; any other bill with a link is the sweep's to
 * read. Inside a group the newest bill is first.
 */
export function heldBills(args: { invoices: readonly HeldInvoice[]; papers: readonly HeldPaper[]; holds: readonly HeldHold[]; houseNames: ReadonlyMap<string, string> }): { standing: LinesStanding; groups: HeldGroup[] } {
  const paperOf = new Map(args.papers.map((p) => [p.invoiceId, p]))
  const holdOf = new Map(args.holds.map((h) => [h.invoiceId, h]))
  const byReason = new Map<HeldReason, HeldBill[]>()
  const standing: LinesStanding = { bills: args.invoices.length, read: 0, addUp: 0, off: 0, held: 0, noPdf: 0, toRead: 0, needPerson: 0 }
  const put = (reason: HeldReason, inv: HeldInvoice, note: string, paperId: string | null) => {
    const list = byReason.get(reason) ?? []
    list.push({ invoiceId: inv.id, houseId: inv.supplyHouseId, houseName: (inv.supplyHouseId && args.houseNames.get(inv.supplyHouseId)) || 'No house', number: inv.number, dateYmd: inv.dateYmd, amountCents: inv.amountCents, link: inv.link, note, paperId })
    byReason.set(reason, list)
  }
  for (const inv of args.invoices) {
    const paper = paperOf.get(inv.id)
    if (paper) {
      standing.read += 1
      if (paper.checkState !== 'off') {
        standing.addUp += 1
        continue
      }
      standing.off += 1
      put(noteIsRowAmount(paper.checkNote) ? 'row_amount' : 'sums', inv, paper.checkNote, paper.id)
      continue
    }
    if (!(inv.link ?? '').trim()) {
      standing.noPdf += 1
      put('no_pdf', inv, '', null)
      continue
    }
    const hold = holdOf.get(inv.id)
    if (!fileIdOfLink(inv.link)) {
      standing.held += 1
      put('link', inv, '', null)
      continue
    }
    if (!hold || hold.why === 'reading') {
      standing.toRead += 1
      continue
    }
    standing.held += 1
    put(hold.why, inv, hold.note, null)
  }
  const groups: HeldGroup[] = []
  for (const g of HELD_GROUPS) {
    const bills = byReason.get(g.reason)
    if (!bills?.length) continue
    bills.sort((a, b) => (a.dateYmd === b.dateYmd ? a.number.localeCompare(b.number) : b.dateYmd.localeCompare(a.dateYmd)))
    groups.push({ ...g, presses: [...g.presses], bills })
    if (g.reason !== 'no_pdf' && g.presses.length) standing.needPerson += bills.length
  }
  return { standing, groups }
}

const n = (v: number): string => v.toLocaleString('en-US')

/** The tab's one line: *Lines read on 496 of 543 bills · 475 add up · 47 need a person · 19 with no PDF*. */
export function standingWords(s: LinesStanding): string {
  const parts = [`Lines read on ${n(s.read)} of ${n(s.bills)} ${s.bills === 1 ? 'bill' : 'bills'}`]
  if (s.read) parts.push(`${n(s.addUp)} ${s.addUp === 1 ? 'adds' : 'add'} up`)
  if (s.needPerson) parts.push(`${n(s.needPerson)} ${s.needPerson === 1 ? 'needs' : 'need'} a person`)
  if (s.toRead) parts.push(`${n(s.toRead)} to read`)
  if (s.noPdf) parts.push(`${n(s.noPdf)} with no PDF`)
  return parts.join(' · ')
}

/** The press that opens the window: *Show the 47*, or *Show the bills* when none needs a person and some have no PDF. */
export function showHeldLabel(s: LinesStanding): string {
  return s.needPerson > 0 ? `Show the ${n(s.needPerson)}` : 'Show the bills'
}

/** A group's own press: *Show the 12*, *Hide the 12*. */
export function groupToggleLabel(open: boolean, count: number): string {
  return `${open ? 'Hide' : 'Show'} the ${n(count)}`
}

/** A bill's press in words. */
export const HELD_PRESS_WORDS: Readonly<Record<HeldPress, string>> = { look: 'Look', bill: 'Open the bill' }

/** The sweep's note under the counts, while it has bills to read. */
export function toReadWords(toRead: number): string {
  if (toRead <= 0) return ''
  return toRead === 1 ? '1 bill is waiting to be read. The app reads it by itself within a few minutes.' : `${n(toRead)} bills are waiting to be read. The app reads them by itself within a few minutes.`
}
