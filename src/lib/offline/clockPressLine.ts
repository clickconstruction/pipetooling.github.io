import { formatDenverTimeOnly } from '../../utils/dateUtils'
import { OUTBOX_KIND_WORDS, SENT_MARK, WAITING_WORDS, needsAPerson, type FormatTime, type OutboxPress } from './outbox'

/**
 * The words beside the clock (punch list #163 PR 2): the newest clock press that went through
 * the queue today, in the strip's colour. Pure; the component is `components/clock/ClockPressLine.tsx`.
 */

export interface ClockPressLineWords {
  tone: 'amber' | 'green' | 'red'
  text: string
  /** Offer Fix: the press needs a person. */
  fix: boolean
  pressId: string
}

/** The newest clock press (in or out) by its order; null when none. */
export function newestClockPress(presses: readonly OutboxPress[]): OutboxPress | null {
  let newest: OutboxPress | null = null
  for (const p of presses) {
    if (p.kind !== 'clock-in' && p.kind !== 'clock-out') continue
    if (!newest || p.seq > newest.seq) newest = p
  }
  return newest
}

export function clockPressLineWords(presses: readonly OutboxPress[], now: number, formatTime: FormatTime = formatDenverTimeOnly): ClockPressLineWords | null {
  const p = newestClockPress(presses)
  if (!p) return null
  const name = OUTBOX_KIND_WORDS[p.kind]
  const pressed = formatTime(p.pressedAt)
  if (needsAPerson(p, now)) {
    return { tone: 'red', text: `${name} ${pressed} · could not be sent`, fix: true, pressId: p.id }
  }
  if (p.state === 'sent') {
    return { tone: 'green', text: `${name} ${pressed} · sent ${formatTime(p.sentAt ?? now)} ${SENT_MARK}`, fix: false, pressId: p.id }
  }
  if (p.state === 'sending') {
    return { tone: 'amber', text: `${name} pressed at ${pressed} · sending…`, fix: false, pressId: p.id }
  }
  return { tone: 'amber', text: `${name} pressed at ${pressed} · ${WAITING_WORDS}`, fix: false, pressId: p.id }
}
