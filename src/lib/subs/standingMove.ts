/**
 * Standing → next (v2.2963 prototype): the one move out of a row's state, as
 * a button. Reads the board's own next-action rule (`sheetNextAction`) and
 * the rail's current dot, and adds the tone the button wears: blue for the
 * normal move, amber when something lapsed, green when money moves, quiet
 * text when the sub owns the step. Pure.
 */
import type { WorkOrderBoardRow } from '../subWorkOrders/workOrderBoardRows'
import { daysBetweenYmd } from '../subWorkOrders/sheetRail'

export type MoveTone = 'primary' | 'ghost' | 'warn' | 'ok' | 'quiet'
export type MoveKind = 'draft' | 'price' | 'send' | 'view' | 'nudge' | 'resend' | 'reoffer' | 'wait_sub' | 'inspection' | 'passed' | 'bill' | 'pay' | 'done' | 'offer_stage'
export type StandingMove = { kind: MoveKind; label: string; tone: MoveTone; hint: string | null }

const money = (n: number) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** "Behar" from "Behar Kraja"; a multi-name sheet keeps the whole string. */
export function subFirstName(subName: string): string {
  const s = subName.trim()
  if (!s) return 'the sub'
  if (s.includes(',') || s.includes('|')) return s
  return s.split(/\s+/)[0] ?? s
}

export type StandingMoveContext = {
  todayYmd: string
  customerName?: string | null
  /** Days an offer may sit before the office nudges (default 3). */
  nudgeAfterDays?: number
}

/** The primary move and, for the one state with two real moves, the second. */
export function standingMovesForRow(row: WorkOrderBoardRow, ctx: StandingMoveContext): { primary: StandingMove; second: StandingMove | null } {
  const c = row.coverage
  const first = subFirstName(row.subName)
  const none = (m: StandingMove) => ({ primary: m, second: null })
  if (c.kind === 'none') return none({ kind: 'draft', label: 'Get it in writing', tone: 'primary', hint: row.next.hint })
  if (c.kind === 'draft') return c.unpriced ? none({ kind: 'price', label: 'Price it and send', tone: 'primary', hint: row.next.hint }) : none({ kind: 'send', label: 'Send it', tone: 'primary', hint: row.next.hint })
  if (c.kind === 'declined') return none({ kind: 'reoffer', label: 'Re-offer…', tone: 'warn', hint: row.next.hint })
  if (c.kind === 'sent') {
    if (c.expired) return none({ kind: 'resend', label: 'Re-send…', tone: 'warn', hint: c.expiresOn ? `expired ${c.expiresOn}` : row.next.hint })
    const days = daysBetweenYmd(c.sentAt, ctx.todayYmd)
    if (days >= (ctx.nudgeAfterDays ?? 3)) return none({ kind: 'nudge', label: `Nudge ${first}`, tone: 'warn', hint: `out ${days} days · a nudge is due` })
    return none({ kind: 'view', label: `Waiting on ${first}${days > 0 ? ` · ${days} day${days === 1 ? '' : 's'}` : ''}`, tone: 'ghost', hint: c.expiresOn ? `good through ${c.expiresOn}` : null })
  }
  // Signed: the sheet's own step.
  switch (row.rail.current) {
    case 'inspection':
      return { primary: { kind: 'inspection', label: 'Schedule inspection…', tone: 'primary', hint: `${first} said the work is done` }, second: { kind: 'passed', label: 'Passed → bill', tone: 'ok', hint: null } }
    case 'customer_pays':
      return none({ kind: 'bill', label: `Bill ${ctx.customerName?.trim() || 'the customer'}`, tone: 'primary', hint: `${first} is owed ${money(row.open)} once they pay` })
    case 'paid':
      return row.open > 0 ? none({ kind: 'pay', label: `Pay ${first} · ${money(row.open)}`, tone: 'ok', hint: 'queued for the pay run' }) : none({ kind: 'done', label: 'Nothing — done', tone: 'quiet', hint: null })
    default:
      return none({ kind: 'wait_sub', label: `Waiting on ${first}`, tone: 'quiet', hint: `${first} taps Done on their portal` })
  }
}

/** A stage row (a window with no order): the move is always to put a sub on it. */
export const STAGE_ROW_MOVE: StandingMove = { kind: 'offer_stage', label: 'Offer to…', tone: 'primary', hint: 'the window comes along as its dates' }
