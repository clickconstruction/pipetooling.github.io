/**
 * The Collect desk, PR G (v2.5858): Friday. Monday's recorded plan asked for
 * money from a few payers; Friday says what landed, which calls ended with a
 * date, whether the notices went out, and what Monday carries. Landed after a
 * call is a payment within the attribution window after a recorded touch on
 * that payer since the plan (the owner's decision 2); landed on its own pace
 * is everything else. A statement is never in the calls' denominator. Pure.
 */
import type { BridgeCall } from '../calls'
import type { ChaseTouch } from '../../jobs/paymentChaseTouches'
import { stageUsd } from '../stageFlow'
import type { CollectSheet, CollectSheetRow } from './collectMoves'
import { calendarYmdInAppTzFromIso } from '../../../utils/dateUtils'

export type CollectPaymentSince = { payerId: string | null; payerName: string; usd: number; paidOn: string }

export type CollectNoticesSince = { drafted: number; signed: number; mailed: number; affidavitsFiled: number }

export type CollectScorecardInput = {
  /** This week's plan, recorded on Collect. */
  call: BridgeCall
  /** Today's sheet, for Monday carries; a planned payer that paid off is scored from the plan alone. */
  sheet: CollectSheet
  touches: ReadonlyArray<ChaseTouch> | null
  payments: ReadonlyArray<CollectPaymentSince>
  notices: CollectNoticesSince | null
  todayYmd: string
  /** A payment this many days or fewer after a recorded touch counts as after a call. */
  attributionDays?: number
}

export type CollectScorecardRow = {
  payerName: string
  /** Today's row, null when the payer paid off and left the sheet. */
  row: CollectSheetRow | null
  /** The move as the plan recorded it, when the plan named this payer. */
  planned: BridgeCall['moves'][number] | null
  isCall: boolean
  landedUsd: number
  landedAfterCallUsd: number
  /** A promise recorded since the plan, or money landed. */
  dated: boolean
  disputed: boolean
  touchesSince: number
  /** What Monday carries: the move still open, or nothing. */
  carries: string | null
}

export type CollectScorecard = {
  rows: CollectScorecardRow[]
  askUsd: number
  landedUsd: number
  landedAfterCallUsd: number
  landedShare: number
  calls: number
  datedCalls: number
  noDateCalls: number
  onOwnerCalls: number
  notices: CollectNoticesSince | null
  /** The verdict in words, for the card's head. */
  words: string
  carries: string[]
}

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)

/** The plan's title is "<payer>: <move>"; a statement alone is the one move that is not a call. */
export function plannedMoveParts(title: string): { payerName: string; move: string } | null {
  const i = title.indexOf(': ')
  return i > 0 ? { payerName: title.slice(0, i), move: title.slice(i + 2) } : null
}
const isCallMove = (move: string): boolean => move.trim().toLowerCase() !== 'send the statement'

export function collectScorecard(input: CollectScorecardInput): CollectScorecard {
  const attributionDays = input.attributionDays ?? 7
  const since = input.call.calledOn
  const planned = new Map<string, BridgeCall['moves'][number]>()
  for (const m of input.call.moves) {
    const parts = plannedMoveParts(m.title)
    if (parts) planned.set(parts.payerName, m)
  }
  const touchesByPayer = new Map<string, ChaseTouch[]>()
  for (const t of input.touches ?? []) {
    const day = calendarYmdInAppTzFromIso(t.createdAt)
    if (day < since || day > input.todayYmd) continue
    const list = touchesByPayer.get(t.customerId) ?? []
    list.push(t)
    touchesByPayer.set(t.customerId, list)
  }
  // The payers to score: today's sheet, then any planned payer no longer on it.
  const entries: Array<{ payerName: string; payerId: string | null; row: CollectSheetRow | null }> = input.sheet.rows.map((row) => ({ payerName: row.payer.payerName, payerId: row.payer.payerId, row }))
  for (const name of planned.keys()) {
    if (entries.some((e) => e.payerName === name)) continue
    const pay = input.payments.find((p) => p.payerName === name)
    entries.push({ payerName: name, payerId: pay?.payerId ?? null, row: null })
  }
  const rows: CollectScorecardRow[] = []
  let landedUsd = 0
  let landedAfterCallUsd = 0
  let calls = 0
  let datedCalls = 0
  let noDateCalls = 0
  let onOwnerCalls = 0
  const carries: string[] = []
  for (const e of entries) {
    const plan = planned.get(e.payerName) ?? null
    const planMove = plan ? plannedMoveParts(plan.title)?.move ?? '' : ''
    const isCall = plan ? isCallMove(planMove) : (e.row?.move.isCall ?? false)
    const touches = e.payerId ? (touchesByPayer.get(e.payerId) ?? []) : []
    const pays = input.payments.filter((p) => (e.payerId != null ? p.payerId === e.payerId : p.payerName === e.payerName) && p.paidOn >= since && p.paidOn <= input.todayYmd)
    let landed = 0
    let afterCall = 0
    for (const p of pays) {
      landed += p.usd
      const touched = touches.some((t) => {
        const gap = Math.round((Date.parse(`${p.paidOn}T12:00:00Z`) - Date.parse(`${calendarYmdInAppTzFromIso(t.createdAt)}T12:00:00Z`)) / 86_400_000)
        return gap >= 0 && gap <= attributionDays
      })
      if (touched) afterCall += p.usd
    }
    landedUsd += landed
    landedAfterCallUsd += afterCall
    const dated = touches.some((t) => t.outcome === 'promised') || landed > 0
    const disputed = touches.some((t) => t.outcome === 'dispute')
    if (isCall) {
      calls += 1
      if (disputed) onOwnerCalls += 1
      else if (dated) datedCalls += 1
      else noDateCalls += 1
    }
    let carry: string | null = null
    const row = e.row
    if (row) {
      const open = stageUsd(row.payer.usd)
      if (disputed) carry = `${e.payerName}: your decision, ${open}.`
      else if (row.move.isCall && !dated) carry = `${e.payerName}: ${row.move.title}, ${open}.`
      else if (row.payer.promise.state === 'promised' && row.payer.promise.promise) carry = `${e.payerName}: watch ${row.payer.promise.promise.promisedYmd}, ${stageUsd(row.payer.promise.usd)}.`
      else if (row.payer.promise.state === 'broken') carry = `${e.payerName}: the promise is broken, first call Monday, ${open}.`
    }
    if (carry) carries.push(carry)
    rows.push({ payerName: e.payerName, row, planned: plan, isCall, landedUsd: landed, landedAfterCallUsd: afterCall, dated, disputed, touchesSince: touches.length, carries: carry })
  }
  const askUsd = input.call.moves.reduce((s, m) => s + (m.then ?? 0), 0) || input.sheet.askUsd
  const landedShare = askUsd > 0 ? landedUsd / askUsd : 0
  const n = input.notices
  const noticeWords = n ? (n.mailed > 0 ? `${n.mailed} ${plural(n.mailed, 'notice', 'notices')} went out` : n.signed > 0 ? `${n.signed} ${plural(n.signed, 'notice', 'notices')} signed, none mailed yet` : n.drafted > 0 ? `${n.drafted} ${plural(n.drafted, 'notice', 'notices')} drafted, none signed yet` : 'no notice moved') : 'the notices are not read'
  const words = `${stageUsd(landedUsd)} of the ${stageUsd(askUsd)} asked for landed, ${stageUsd(landedAfterCallUsd)} of it after a call. ${datedCalls} of ${calls} ${plural(calls, 'call', 'calls')} ended with a date${onOwnerCalls > 0 ? `, ${onOwnerCalls} on the owner` : ''}. ${noticeWords.charAt(0).toUpperCase()}${noticeWords.slice(1)}.`
  return { rows, askUsd, landedUsd, landedAfterCallUsd, landedShare, calls, datedCalls, noDateCalls, onOwnerCalls, notices: n, words, carries }
}
