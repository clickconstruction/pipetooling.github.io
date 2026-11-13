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
 * - The list holds 12 ways at most and never none. Each press that the list refuses says why, in one sentence, before
 *   the database is asked (`handWay…Problem`); the table's guard holds the same lines for two people at once.
 */
import { calendarYmdInAppTzFromIso, formatWorkDateYmdWeekdayShortFriendly } from '../../utils/dateUtils'
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

// ── Editing the list (punch list #340, PR 3): the words each press says, and what it refuses ─────────────────────────

/** Typed words as the list keeps them: no space at either end, one space between words. */
export function cleanHandWayLabel(typed: string): string {
  return typed.replace(/\s+/g, ' ').trim()
}

/** How full the list is, for the line under it: *5 of 12*. */
export function handWayCountWords(ways: ReadonlyArray<BillHandWay>): string {
  return `${liveBillHandWays(ways).length} of ${BILL_HAND_WAYS_CAP}`
}

const LIST_FULL = `The list is full at ${BILL_HAND_WAYS_CAP} ways. Take one off first.`
const SAME_WORDS = 'That way is already on the list.'

const sameWords = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

/** Why these words cannot name a way, one sentence; '' when they can. `exceptId` is the way being renamed. */
export function handWayNameProblem(typed: string, ways: ReadonlyArray<BillHandWay>, exceptId = ''): string {
  const label = cleanHandWayLabel(typed)
  if (!label) return 'Type the way in a few words.'
  if (label.length > BILL_HAND_WAY_LABEL_MAX) return `Keep it to ${BILL_HAND_WAY_LABEL_MAX} characters. This is ${label.length}.`
  if (liveBillHandWays(ways).some((w) => w.id !== exceptId && sameWords(w.label, label))) return SAME_WORDS
  return ''
}

/** Why a new way cannot be added; '' when it can. */
export function handWayAddProblem(typed: string, ways: ReadonlyArray<BillHandWay>): string {
  if (!cleanHandWayLabel(typed)) return 'Type the new way in a few words.'
  if (liveBillHandWays(ways).length >= BILL_HAND_WAYS_CAP) return LIST_FULL
  return handWayNameProblem(typed, ways)
}

/** Why a way cannot be taken off; '' when it can. The form must always have one to pick. */
export function handWayTakeOffProblem(way: BillHandWay, ways: ReadonlyArray<BillHandWay>): string {
  return liveBillHandWays(ways).some((w) => w.id !== way.id) ? '' : 'The list needs one way. Add another before you take this one off.'
}

/** Why a way taken off cannot come back; '' when it can. */
export function handWayBringBackProblem(way: BillHandWay, ways: ReadonlyArray<BillHandWay>): string {
  const live = liveBillHandWays(ways)
  if (live.length >= BILL_HAND_WAYS_CAP) return LIST_FULL
  if (live.some((w) => sameWords(w.label, way.label))) return 'A way with these words is on the list now. Rename that one first.'
  return ''
}

/**
 * A way moved one place up or down: the rows whose place changes, with their new place. Two rows trade places when
 * their places differ; a list with a tie is numbered again from 1. Null at the top going up and the bottom going down.
 */
export function handWayMove(ways: ReadonlyArray<BillHandWay>, id: string, dir: 'up' | 'down'): Array<{ id: string; sortOrder: number }> | null {
  const live = liveBillHandWays(ways)
  const at = live.findIndex((w) => w.id === id)
  const to = dir === 'up' ? at - 1 : at + 1
  if (at < 0 || to < 0 || to >= live.length) return null
  const a = live[at]!
  const b = live[to]!
  if (a.sortOrder !== b.sortOrder) return [{ id: a.id, sortOrder: b.sortOrder }, { id: b.id, sortOrder: a.sortOrder }]
  const next = live.slice()
  next[at] = b
  next[to] = a
  return next.map((w, i) => ({ id: w.id, sortOrder: i + 1 })).filter((m) => live.find((w) => w.id === m.id)!.sortOrder !== m.sortOrder)
}

const dayWords = (iso: string | null): string => {
  const ymd = iso && Number.isFinite(Date.parse(iso)) ? calendarYmdInAppTzFromIso(iso) : ''
  return ymd ? formatWorkDateYmdWeekdayShortFriendly(ymd) : ''
}

/** Who added a way and when: *Added by Priya on Wed, Nov 11*. '' for the four the form began with. */
export function handWayAddedWords(way: BillHandWay): string {
  if (!way.createdByName) return ''
  const day = dayWords(way.createdAtIso)
  return `Added by ${way.createdByName}${day ? ` on ${day}` : ''}`
}

/** Who took a way off and when: *Taken off by Marcus on Mon, Nov 9*. */
export function handWayTakenOffWords(way: BillHandWay): string {
  if (!way.retiredAtIso) return ''
  const day = dayWords(way.retiredAtIso)
  return `Taken off${way.retiredByName ? ` by ${way.retiredByName}` : ''}${day ? ` on ${day}` : ''}`
}
