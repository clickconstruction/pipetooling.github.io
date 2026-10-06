// Job Parts Tally → Transactions → Team (punch list #72, PR 2a): the office's queue of the team's
// unsorted card charges, one card per person per day of the swipe. This turns the four reads (the staff queue,
// the card charges window for history, clock sessions, schedule blocks) into the day cards, the
// people strip and the through-date. Pure: the reads are `fetchTallyTeamQueue.ts`, the guesses
// `tallySortSuggestion.ts`, the words `tallySuggestionWords.ts`.

import { mercuryCategoryString } from '../mercuryOfficeLikeCategories'
import { mercurySwipeAtIso } from '../mercurySwipeTime'
import type { CardChargeWindowRow } from '../banking/cardChargesWindow'
import { ymdAddDays } from '../../utils/dateUtils'
import type { StaleStaffRow } from './teamPurchaseRows'
import {
  suggestTallyDay,
  tallyDayKey,
  type TallyCharge,
  type TallyDaySuggestion,
  type TallySortedCharge,
} from './tallySortSuggestion'

/** One clock session as read for the queue's holders. */
export type TallyQueueSessionRow = {
  user_id: string
  work_date: string
  job_ledger_id: string | null
  clocked_in_at: string
  clocked_out_at: string | null
}

/** One schedule block as read for the queue's holders. */
export type TallyQueueScheduleRow = {
  assignee_user_id: string
  work_date: string
  job_id: string | null
}

export type TallyTeamQueueInput = {
  /** The staff queue: the team's unsorted charges. */
  queue: readonly StaleStaffRow[]
  /** The card charges window: history (purchases with splits) and each day's sorted lines. */
  history: readonly CardChargeWindowRow[]
  sessions: readonly TallyQueueSessionRow[]
  schedule: readonly TallyQueueScheduleRow[]
  officeJobId: string | null
  nowMs: number
}

/** One unsorted charge on a card: the staff row (for the windows) and the kernel's charge. */
export type TallyQueueCharge = {
  row: StaleStaffRow
  charge: TallyCharge
}

/** One person's day: the cards the office sorts. */
export type TallyQueueCard = {
  holderId: string
  holderName: string
  ymd: string
  charges: TallyQueueCharge[]
  /** The signed total of the unsorted charges. */
  total: number
  suggestion: TallyDaySuggestion
  /** The day's charges already sorted (to a job, to invoices or as payroll), oldest first. */
  sorted: CardChargeWindowRow[]
}

export type TallyQueueDay = {
  ymd: string
  cards: TallyQueueCard[]
}

/** One person on the strip: who has charges to sort, the one furthest behind first. */
export type TallyQueuePerson = {
  holderId: string
  holderName: string
  charges: number
  days: number
  oldestYmd: string
}

export type TallyTeamQueue = {
  /** Newest day first; within a day, by name. */
  days: TallyQueueDay[]
  people: TallyQueuePerson[]
  /** The last day with nothing left to sort: the day before the oldest unsorted charge. */
  throughYmd: string | null
  charges: number
  dayCount: number
}

/** Mercury's category on a staff row (`raw.mercuryCategory`), or null. */
export function tallyCategoryFromRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  return mercuryCategoryString((raw as { mercuryCategory?: unknown }).mercuryCategory)
}

/**
 * When the card was swiped: Mercury's `raw.createdAt`, else `posted_at`. The day card and the
 * time on each line read this; the date floor and the over-2-days count stay on `posted_at`.
 */
export function tallyChargeMadeAt(row: StaleStaffRow): string | null {
  return mercurySwipeAtIso(row.raw, row.posted_at)
}

/** The staff row as the kernel's charge; null when it has no readable time. */
export function tallyChargeFromStaffRow(row: StaleStaffRow): TallyCharge | null {
  const madeAt = tallyChargeMadeAt(row)
  if (!madeAt) return null
  return {
    id: row.mercury_transaction_id,
    holderId: row.target_user_id,
    madeAt,
    amount: Number(row.amount),
    counterparty: row.counterparty_name ?? '',
    category: tallyCategoryFromRaw(row.raw),
  }
}

/** A window row counts as sorted when it went to a job, to invoices, or was marked payroll. */
function isSorted(row: CardChargeWindowRow): boolean {
  return row.splits.length > 0 || row.invoiceLinks.length > 0 || row.payrollMarked
}

/** The last day with nothing left to sort: the day before the oldest unsorted one. */
export function tallyThroughDate(unsortedYmds: Iterable<string>): string | null {
  let oldest: string | null = null
  for (const ymd of unsortedYmds) if (oldest == null || ymd < oldest) oldest = ymd
  return oldest == null ? null : ymdAddDays(oldest, -1)
}

/** Who has charges to sort, the one furthest behind first (then by name). */
export function tallyPeopleStrip(charges: readonly TallyQueueCharge[]): TallyQueuePerson[] {
  const byHolder = new Map<string, { name: string; charges: number; days: Set<string>; oldest: string }>()
  for (const { row, charge } of charges) {
    const ymd = tallyDayKey(charge.madeAt)!
    const cur = byHolder.get(charge.holderId)
    if (cur) {
      cur.charges += 1
      cur.days.add(ymd)
      if (ymd < cur.oldest) cur.oldest = ymd
    } else {
      byHolder.set(charge.holderId, { name: row.target_name?.trim() || 'Unknown', charges: 1, days: new Set([ymd]), oldest: ymd })
    }
  }
  return [...byHolder.entries()]
    .map(([holderId, v]) => ({ holderId, holderName: v.name, charges: v.charges, days: v.days.size, oldestYmd: v.oldest }))
    .sort((a, b) => (a.oldestYmd !== b.oldestYmd ? (a.oldestYmd < b.oldestYmd ? -1 : 1) : a.holderName.localeCompare(b.holderName)))
}

/** The four reads → the day cards, the strip and the through-date. */
export function buildTallyTeamQueue(input: TallyTeamQueueInput): TallyTeamQueue {
  const charges: TallyQueueCharge[] = []
  for (const row of input.queue) {
    const charge = tallyChargeFromStaffRow(row)
    if (charge) charges.push({ row, charge })
  }

  const historyByHolder = new Map<string, TallySortedCharge[]>()
  const sortedByCard = new Map<string, CardChargeWindowRow[]>()
  for (const h of input.history) {
    if (!h.holderUserId) continue
    if (h.splits.length > 0) {
      const list = historyByHolder.get(h.holderUserId) ?? []
      list.push({
        id: h.id,
        postedAt: h.postedAt,
        counterparty: h.counterpartyName ?? '',
        splits: h.splits.map((s) => ({ jobId: s.jobId, amount: s.amount })),
      })
      historyByHolder.set(h.holderUserId, list)
    }
    if (isSorted(h)) {
      const key = `${h.holderUserId}|${tallyDayKey(h.postedAt)}`
      const list = sortedByCard.get(key) ?? []
      list.push(h)
      sortedByCard.set(key, list)
    }
  }

  const sessionsByHolder = new Map<string, Array<{ workDate: string; jobId: string | null; clockedInAt: string; clockedOutAt: string | null }>>()
  for (const s of input.sessions) {
    const list = sessionsByHolder.get(s.user_id) ?? []
    list.push({ workDate: s.work_date, jobId: s.job_ledger_id, clockedInAt: s.clocked_in_at, clockedOutAt: s.clocked_out_at })
    sessionsByHolder.set(s.user_id, list)
  }
  const scheduleByHolder = new Map<string, Array<{ workDate: string; jobId: string }>>()
  for (const s of input.schedule) {
    if (!s.job_id) continue
    const list = scheduleByHolder.get(s.assignee_user_id) ?? []
    list.push({ workDate: s.work_date, jobId: s.job_id })
    scheduleByHolder.set(s.assignee_user_id, list)
  }

  const cardsByKey = new Map<string, TallyQueueCharge[]>()
  for (const c of charges) {
    const key = `${c.charge.holderId}|${tallyDayKey(c.charge.madeAt)}`
    const list = cardsByKey.get(key) ?? []
    list.push(c)
    cardsByKey.set(key, list)
  }

  const cards: TallyQueueCard[] = []
  for (const [key, list] of cardsByKey) {
    const [holderId, ymd] = key.split('|') as [string, string]
    list.sort((a, b) => Date.parse(a.charge.madeAt) - Date.parse(b.charge.madeAt))
    const suggestion = suggestTallyDay({
      holderId,
      ymd,
      charges: list.map((c) => c.charge),
      sessions: sessionsByHolder.get(holderId) ?? [],
      scheduled: scheduleByHolder.get(holderId) ?? [],
      history: historyByHolder.get(holderId) ?? [],
      officeJobId: input.officeJobId,
      nowMs: input.nowMs,
    })
    const sorted = (sortedByCard.get(key) ?? []).slice().sort((a, b) => Date.parse(a.postedAt) - Date.parse(b.postedAt))
    cards.push({
      holderId,
      holderName: list[0]!.row.target_name?.trim() || 'Unknown',
      ymd,
      charges: list,
      total: Math.round(list.reduce((s, c) => s + c.charge.amount, 0) * 100) / 100,
      suggestion,
      sorted,
    })
  }

  const daysByYmd = new Map<string, TallyQueueCard[]>()
  for (const card of cards) {
    const list = daysByYmd.get(card.ymd) ?? []
    list.push(card)
    daysByYmd.set(card.ymd, list)
  }
  const days = [...daysByYmd.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([ymd, list]) => ({ ymd, cards: list.sort((a, b) => a.holderName.localeCompare(b.holderName)) }))

  return {
    days,
    people: tallyPeopleStrip(charges),
    throughYmd: tallyThroughDate(cards.map((c) => c.ymd)),
    charges: charges.length,
    dayCount: cards.length,
  }
}
