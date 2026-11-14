/**
 * The ways a bill can go when the app did not send it (punch list #340): the list under *How the bill went* in
 * **Say how it went…** on Bills sent. The owner asked that the people who open the page can add to the list and
 * edit it, so the list is rows of `bill_hand_ways` (migration `20261113170000`) and no longer four choices in code.
 *
 * The rules, pure. The reads and writes are `billsSentIo.ts`, the form `components/billing/BillsSentLedger.tsx`.
 *
 * - A way has a key that never changes and words the office may change. A record made by hand keeps both, the words
 *   as they read that day (`source_snapshot.how_label`), so nothing done to this list rewords a record already made.
 * - A way is taken off the list, never deleted: it leaves the form and can be brought back.
 * - The four ways the form began with are the first four rows. They are also kept here, for a read that is refused
 *   (before the table is on the database, or a lost signal): the form then offers these four and saves as it did.
 * - Every way, whichever it is, makes a record by hand. None is an email of ours, so none counts under another chip.
 */
import type { SentHow } from '../sent/sentCopies'

/** The most ways the form shows at once: the chips stay within four rows on a phone. The database holds the same line. */
export const BILL_HAND_WAYS_CAP = 12

/** The longest a way's words may be. */
export const BILL_HAND_WAY_LABEL_MAX = 60

export interface BillHandWay {
  /** The row's id; '' for one of the four kept in code when the list could not be read. */
  id: string
  /** The code a record carries. Never made from the words, never changed. */
  key: string
  /** The words, as the form shows them today. */
  label: string
  /** What the sent copy's own `how` gets: by hand, by mail, by email, or another way for one the office typed. */
  sentHow: SentHow
  sortOrder: number
  /** When it was taken off the list; null while it is on. */
  retiredAtIso: string | null
  retiredByName: string
  /** Who added it; '' for the four the form began with. */
  createdByName: string
  createdAtIso: string | null
}

const builtIn = (key: string, label: string, sentHow: SentHow, sortOrder: number): BillHandWay => ({ id: '', key, label, sentHow, sortOrder, retiredAtIso: null, retiredByName: '', createdByName: '', createdAtIso: null })

/** The four ways the form began with, under the keys the oldest records carry. */
export const BILL_HAND_WAYS_BUILT_IN: ReadonlyArray<BillHandWay> = [
  builtIn('handed', 'Handed over', 'hand', 1),
  builtIn('mailed', 'Mailed', 'mail', 2),
  builtIn('own_mailbox', 'Emailed from a person’s own mailbox', 'email', 3),
  builtIn('housecall_pro', 'Sent from Housecall Pro', 'email', 4),
]

const WAY_HOWS: ReadonlyArray<SentHow> = ['hand', 'mail', 'email', 'other']

const text = (v: unknown): string => (typeof v === 'string' ? v : '')

/** A stored row, read defensively; null when it has no id, no key or no words. An unknown `sent_how` reads as another way. */
export function parseBillHandWay(row: unknown): BillHandWay | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const id = text(r.id)
  const key = text(r.key)
  const label = text(r.label).trim()
  if (!id || !key || !label) return null
  const how = text(r.sent_how) as SentHow
  return {
    id,
    key,
    label,
    sentHow: WAY_HOWS.includes(how) ? how : 'other',
    sortOrder: typeof r.sort_order === 'number' && Number.isFinite(r.sort_order) ? r.sort_order : 0,
    retiredAtIso: text(r.retired_at) || null,
    retiredByName: text(r.retired_by_name).trim(),
    createdByName: text(r.created_by_name).trim(),
    createdAtIso: text(r.created_at) || null,
  }
}

const inOrder = (a: BillHandWay, b: BillHandWay): number => a.sortOrder - b.sortOrder || (a.createdAtIso ?? '').localeCompare(b.createdAtIso ?? '') || a.label.localeCompare(b.label)

/** The ways on the list, in the list's order: what the form offers. */
export function liveBillHandWays(ways: ReadonlyArray<BillHandWay>): BillHandWay[] {
  return ways.filter((w) => !w.retiredAtIso).sort(inOrder)
}

/** The ways taken off the list, the latest taken off first. */
export function retiredBillHandWays(ways: ReadonlyArray<BillHandWay>): BillHandWay[] {
  return ways.filter((w) => !!w.retiredAtIso).sort((a, b) => (b.retiredAtIso ?? '').localeCompare(a.retiredAtIso ?? ''))
}

/**
 * The list the form works from. A read that came back with ways on the list is used as it is. A read that was
 * refused, or came back with none on the list, falls back to the four in code, so the form can always record.
 */
export function billHandWaysOrBuiltIn(read: ReadonlyArray<BillHandWay> | null): { ways: BillHandWay[]; fromTable: boolean } {
  if (read && liveBillHandWays(read).length > 0) return { ways: read.slice(), fromTable: true }
  return { ways: BILL_HAND_WAYS_BUILT_IN.slice(), fromTable: false }
}
