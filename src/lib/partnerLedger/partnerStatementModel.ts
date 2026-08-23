/**
 * Partner statement page model (vNEXT): the few decisions the paper makes
 * that aren't already in partnerWeeks — which closed statement (if any) sits
 * under the open week awaiting sign-off, the headline words, and the long
 * dates the letterhead uses. Pure; the page is a view over these.
 */
import type { WeekCard } from './partnerWeeks'

/** Headline words for the balance: + means Click owes the partner. */
export function balanceHeadline(n: number): string {
  if (n > 0) return 'Click owes you'
  if (n < 0) return 'You owe Click'
  return 'Even'
}

/**
 * The last closed statement, only while it awaits the partner's acknowledgment
 * (D7): `cards` are newest-first (index 0 is the live week). The newest closed
 * card that carries a statement is "the last statement"; it is returned only
 * when the partner hasn't acknowledged it yet. Charge-only weeks (no stub)
 * never qualify — there is nothing to sign off.
 */
export function awaitingStatementCard(cards: readonly WeekCard[]): WeekCard | null {
  const last = cards.find((c) => !c.open && c.stubId != null)
  if (!last) return null
  return last.partnerAckAt == null ? last : null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** "Aug 23, 2026" from a YYYY-MM-DD; garbage passes through unchanged. */
export function longDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ymd
  const mon = MONTHS[Number(m[2]) - 1]
  if (!mon) return ymd
  return `${mon} ${Number(m[3])}, ${m[1]}`
}

/** "partner since Mar 22, 2026" — the oldest week card's start (cards newest-first). */
export function partnerSinceLabel(cards: readonly WeekCard[]): string | null {
  const oldest = cards[cards.length - 1]
  return oldest ? `partner since ${longDate(oldest.weekStart)}` : null
}

/** Today's long date from a Date (local calendar). */
export function todayLongDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return longDate(`${y}-${m}-${day}`)
}
