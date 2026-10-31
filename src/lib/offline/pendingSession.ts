import { denverCalendarDayKey } from '../../utils/dateUtils'
import { pendingClockIn } from '../../hooks/useOutbox'
import type { ClockInPayload, ClockOutPayload, OutboxPress } from './outbox'

/**
 * A clock-in still on the phone, as the clock draws it (punch list #163 PR 2): until the press
 * lands the button and the Job Mode card are clocked in on it, with the pressed moment as the
 * start. Its id is the press's under a prefix, so a clock-out on it knows to go through the
 * queue after the clock-in, never to the server by that id.
 */

export const PRESS_SESSION_PREFIX = 'press:'

export function pressSessionId(pressId: string): string {
  return `${PRESS_SESSION_PREFIX}${pressId}`
}

export function isPressSessionId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(PRESS_SESSION_PREFIX)
}

/** The press id under a pending session's id; null for a real session. */
export function pressIdOfSession(id: string | null | undefined): string | null {
  return isPressSessionId(id) ? (id as string).slice(PRESS_SESSION_PREFIX.length) : null
}

export interface PendingOpenSession {
  id: string
  clocked_in_at: string
  clocked_out_at: null
  work_date: string
  notes: string
  job_ledger_id: string | null
  bid_id: string | null
  origin: 'user_punch'
}

/** The row the clock draws for a clock-in press still on the phone. */
export function pendingOpenSession(press: OutboxPress<'clock-in'>): PendingOpenSession {
  const payload = press.payload as ClockInPayload
  return {
    id: pressSessionId(press.id),
    clocked_in_at: new Date(press.pressedAt).toISOString(),
    clocked_out_at: null,
    work_date: denverCalendarDayKey(press.pressedAt),
    notes: payload.notes,
    job_ledger_id: payload.jobLedgerId,
    bid_id: payload.bidId,
    origin: 'user_punch',
  }
}

export const KEPT_ON_PHONE_WORDS = 'Kept on the phone. It goes out when the signal is back.'

/**
 * The clock's own read with no signal, on its Retry panel (punch list #163's live test, v2.6198): read words, never
 * the write sentence's *nothing was saved*, which under a kept clock-out read as the press failing.
 */
export const CLOCK_READ_OFFLINE_WORDS = "No connection, so the clock could not load today's time. It loads again when the signal is back."

/** A row of the clock's read: the open session, or one of today's. */
export interface ClockReadRow {
  id: string
  clocked_in_at: string
  clocked_out_at: string | null
}

/** A clock-in still on the phone as one of today's rows: open, or closed by its own clock-out still on the phone. */
export type PendingSessionRow = Omit<PendingOpenSession, 'clocked_out_at'> & { clocked_out_at: string | null }

function isWaiting(p: OutboxPress): boolean {
  return p.state === 'waiting' || p.state === 'sending'
}

/**
 * The clock as the phone knows it (punch list #163's live test, v2.6198): the server's read with the clock presses
 * still on the phone laid over it, so a read that lands before a press does never contradicts the press. A clock-out
 * waiting closes its session at the moment it was pressed, a real one or one still on the phone; a clock-in waiting
 * is a stretch of today, and the open session when nothing else is open. A refused or a landed press lays nothing
 * over the read: the server's word stands.
 */
export function clockReadWithKeptPresses<T extends ClockReadRow>(
  read: { open: T | null; today: readonly T[] },
  presses: readonly OutboxPress[],
): { open: T | PendingSessionRow | null; today: Array<T | PendingSessionRow> } {
  const closedAt = new Map<string, string>()
  for (const p of presses) {
    if (p.kind !== 'clock-out' || !isWaiting(p)) continue
    const payload = p.payload as ClockOutPayload
    const at = new Date(p.pressedAt).toISOString()
    if (payload.sessionId) closedAt.set(payload.sessionId, at)
    if (payload.sessionPressId) closedAt.set(pressSessionId(payload.sessionPressId), at)
  }
  const close = <R extends ClockReadRow>(row: R): R => {
    const at = closedAt.get(row.id)
    return at && !row.clocked_out_at ? { ...row, clocked_out_at: at } : row
  }
  let open: T | PendingSessionRow | null = read.open && !closedAt.has(read.open.id) ? read.open : null
  const today: Array<T | PendingSessionRow> = read.today.map(close)
  const pending = pendingClockIn(presses)
  for (const p of presses) {
    if (p.kind !== 'clock-in' || !isWaiting(p)) continue
    const row = close<PendingSessionRow>(pendingOpenSession(p as OutboxPress<'clock-in'>))
    if (row.clocked_out_at) today.push(row)
    else if (!open && p.id === pending?.id) {
      open = row
      today.push(row)
    }
  }
  return { open, today }
}

/** The clock presses by id, a press waiting or in flight as one state: what the clock reads again on. */
export function clockPressStates(presses: readonly OutboxPress[]): ReadonlyMap<string, string> {
  const states = new Map<string, string>()
  for (const p of presses) {
    if (p.kind === 'clock-in' || p.kind === 'clock-out') states.set(p.id, isWaiting(p) ? 'waiting' : p.state)
  }
  return states
}

/**
 * Whether the clock reads again when the queue changes (punch list #163): a press it already knew landed, was refused
 * or is gone; or one it had not seen appeared while the browser says online, such as a press read back from the
 * device after the clock's own read. A press kept with no signal was drawn by the handler that kept it, and a try that
 * failed changes nothing, so neither sets off a read, which with no signal could only fail under the press (the live
 * test of 2026-10-30, v2.6198).
 */
export function clockReadsAgain(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>, online: boolean): boolean {
  for (const [id, state] of before) {
    if (after.get(id) !== state) return true
  }
  if (!online) return false
  for (const id of after.keys()) {
    if (!before.has(id)) return true
  }
  return false
}
