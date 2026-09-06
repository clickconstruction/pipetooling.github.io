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


const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** "Aug 23, 2026" from a YYYY-MM-DD; garbage passes through unchanged. */
export function longDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ymd
  const mon = MONTHS[Number(m[2]) - 1]
  if (!mon) return ymd
  return `${mon} ${Number(m[3])}, ${m[1]}`
}

/**
 * The letterhead's tenure words (v2.2914, J26-F7): "partner since" once the
 * deal is live, "draft since" while `partnerships.status` is still `draft` —
 * the paper stops asserting a partnership the Agreements tab says isn't
 * signed yet. Paused / ended deals keep "partner since" (the tenure is real).
 */
export function partnerSincePrefix(status: string | null | undefined): 'partner since' | 'draft since' {
  return status === 'draft' ? 'draft since' : 'partner since'
}

/** "partner since Mar 22, 2026" — the oldest week card's start (cards newest-first). */
export function partnerSinceLabel(cards: readonly WeekCard[], status: string | null | undefined = null): string | null {
  const oldest = cards[cards.length - 1]
  return oldest ? `${partnerSincePrefix(status)} ${longDate(oldest.weekStart)}` : null
}

/**
 * The full tenure line: the deal's `started_on` when the record has one, else
 * the oldest week on file; null when neither exists.
 */
export function partnerSinceLine(
  summary: { started_on: string | null; status: string | null },
  cards: readonly WeekCard[],
): string | null {
  if (summary.started_on) return `${partnerSincePrefix(summary.status)} ${longDate(summary.started_on)}`
  return partnerSinceLabel(cards, summary.status)
}

/** Today's long date from a Date (local calendar). */
export function todayLongDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return longDate(`${y}-${m}-${day}`)
}
