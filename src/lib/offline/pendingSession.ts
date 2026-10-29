import { denverCalendarDayKey } from '../../utils/dateUtils'
import type { ClockInPayload, OutboxPress } from './outbox'

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
