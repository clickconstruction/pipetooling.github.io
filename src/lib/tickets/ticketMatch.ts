/**
 * Counter tickets (punch list #295, PR 1): how a ticket meets its card charge. Pure: tickets and charges in, one
 * answer a ticket out. The screens write a `made` match with no press, put an `ask` to a person as Yes or No, and list
 * a `none` for the office.
 *
 * The bank feed holds the instant of every swipe from the moment the card is run, days before the charge settles
 * (`mercury_transactions.created_at`), so a ticket taken at the counter is matched by the minute and the tech types
 * nothing. A read of the feed on 2026-11-09 (200 card charges, 2026-10-10 to 10-23) set the rules' edges:
 * - A field card's swipes mostly stand alone, so the only swipe in the half hour before the photo is the ticket's.
 * - Two cards ran five and more charges inside ten minutes, and a few visits made two charges seconds apart. So the
 *   rule holds only when exactly one charge fits. Two that fit are never guessed between: a typed total decides, or
 *   the office picks.
 * - Many charges had failed, a card declined and run again. A failed charge never matches, and the one that went
 *   through does.
 *
 * The rules, the first that holds:
 * 1. `made` by `minute`: the ticket knows when it was taken, and exactly one charge on a card of the taker's was
 *    swiped in the half hour before it. A typed total that is not that charge's amount stops it: the person is asked.
 * 2. `made` by `total`: the taker typed a total, and exactly one charge on a card of theirs is for that amount within
 *    a day of the ticket.
 * 3. `ask` the taker: exactly one charge on a card of theirs fits more loosely (the same total in the two weeks
 *    before, or the only charge in the twelve hours before a ticket taken late).
 * 4. `ask` the office: exactly one charge on another person's card fits by the minute or by the total. A helper takes
 *    the photo and the lead's card pays; that is never matched without a person.
 * 5. `none`: nothing fits, or several do. The charges that fit ride along so the office picks among them.
 *
 * A charge another live ticket holds, a charge this ticket was said not to be, a failed or cancelled charge and a
 * charge of nothing are never candidates. Money back matches as a purchase does, by its size.
 */

export const TICKET_MINUTE_BEFORE_MS = 30 * 60 * 1000
/** A phone's clock and the bank's differ by a little; a ticket is never taken long before its swipe. */
export const TICKET_MINUTE_AFTER_MS = 5 * 60 * 1000
export const TICKET_TOTAL_WINDOW_MS = 24 * 60 * 60 * 1000
export const TICKET_LATE_WINDOW_MS = 12 * 60 * 60 * 1000
export const TICKET_LOOSE_TOTAL_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

export interface MatchTicket {
  id: string
  takenBy: string | null
  /** `taken_at` as epoch milliseconds. */
  takenAtMs: number
  /** `none` is a PDF or a paper handed in: its time says nothing about the purchase. */
  takenAtFrom: 'press' | 'photo' | 'none'
  /** The typed total in dollars, or null. */
  total: number | null
  /** Charges a person said this ticket is not. */
  declined: readonly string[]
}

export interface MatchCharge {
  id: string
  /** The person the charge's card is linked to, or null for a card tied to no one. */
  cardHolderId: string | null
  /** The swipe as epoch milliseconds. */
  swipeAtMs: number
  /** Signed dollars as the feed has them. */
  amount: number
  status: string
  /** The live ticket that already holds this charge, if any. */
  ticketId?: string | null
}

export type TicketMatch =
  | { kind: 'made'; by: 'minute' | 'total'; chargeId: string }
  | { kind: 'ask'; who: 'taker' | 'office'; why: 'total' | 'late' | 'other_card'; chargeId: string }
  | { kind: 'none'; why: 'no_charge' | 'several_fit'; chargeIds: string[] }

const DEAD_STATUSES: ReadonlySet<string> = new Set(['failed', 'cancelled', 'canceled'])

function cents(n: number): number {
  return Math.round(Math.abs(n) * 100)
}

function sameAmount(charge: MatchCharge, total: number | null): boolean {
  return total !== null && Number.isFinite(total) && total > 0 && cents(charge.amount) === cents(total)
}

function inMinuteWindow(t: MatchTicket, c: MatchCharge): boolean {
  return t.takenAtFrom !== 'none' && c.swipeAtMs >= t.takenAtMs - TICKET_MINUTE_BEFORE_MS && c.swipeAtMs <= t.takenAtMs + TICKET_MINUTE_AFTER_MS
}

function isOwn(t: MatchTicket, c: MatchCharge): boolean {
  return !!t.takenBy && c.cardHolderId === t.takenBy
}

/** The charges a ticket may be matched to at all, before any rule. */
function candidates(t: MatchTicket, charges: readonly MatchCharge[], claimed: ReadonlySet<string>): MatchCharge[] {
  return charges.filter(
    (c) =>
      !DEAD_STATUSES.has(String(c.status).toLowerCase()) &&
      cents(c.amount) > 0 &&
      Number.isFinite(c.swipeAtMs) &&
      !c.ticketId &&
      !claimed.has(c.id) &&
      !t.declined.includes(c.id),
  )
}

/** Rules 1 and 2: a match made with no press, or null. */
function madeMatch(t: MatchTicket, pool: readonly MatchCharge[]): Extract<TicketMatch, { kind: 'made' }> | null {
  const own = pool.filter((c) => isOwn(t, c))
  const byMinute = own.filter((c) => inMinuteWindow(t, c))
  if (byMinute.length === 1) {
    // A typed total that disagrees with the one swipe is a reason to ask, not to match.
    if (t.total !== null && !sameAmount(byMinute[0]!, t.total)) return null
    return { kind: 'made', by: 'minute', chargeId: byMinute[0]!.id }
  }
  if (byMinute.length > 1) {
    // Several swipes in the half hour: only a typed total tells them apart.
    const byBoth = byMinute.filter((c) => sameAmount(c, t.total))
    return byBoth.length === 1 ? { kind: 'made', by: 'total', chargeId: byBoth[0]!.id } : null
  }
  if (t.takenAtFrom === 'none') return null
  const byTotal = own.filter((c) => sameAmount(c, t.total) && Math.abs(c.swipeAtMs - t.takenAtMs) <= TICKET_TOTAL_WINDOW_MS)
  return byTotal.length === 1 ? { kind: 'made', by: 'total', chargeId: byTotal[0]!.id } : null
}

/** Rules 3 to 5, for a ticket no rule matched by itself. */
function looseMatch(t: MatchTicket, pool: readonly MatchCharge[]): TicketMatch {
  const own = pool.filter((c) => isOwn(t, c))
  const ownByMinute = own.filter((c) => inMinuteWindow(t, c))
  if (ownByMinute.length > 1) return { kind: 'none', why: 'several_fit', chargeIds: ownByMinute.map((c) => c.id) }

  const ownByTotal = own.filter((c) => sameAmount(c, t.total) && c.swipeAtMs <= t.takenAtMs + TICKET_MINUTE_AFTER_MS && c.swipeAtMs >= t.takenAtMs - TICKET_LOOSE_TOTAL_WINDOW_MS)
  if (ownByTotal.length === 1) return { kind: 'ask', who: 'taker', why: 'total', chargeId: ownByTotal[0]!.id }
  if (ownByTotal.length > 1) return { kind: 'none', why: 'several_fit', chargeIds: ownByTotal.map((c) => c.id) }

  if (t.takenAtFrom !== 'none') {
    const ownLate = own.filter((c) => c.swipeAtMs <= t.takenAtMs + TICKET_MINUTE_AFTER_MS && c.swipeAtMs >= t.takenAtMs - TICKET_LATE_WINDOW_MS)
    if (ownLate.length === 1) return { kind: 'ask', who: 'taker', why: 'late', chargeId: ownLate[0]!.id }
    if (ownLate.length > 1) return { kind: 'none', why: 'several_fit', chargeIds: ownLate.map((c) => c.id) }
  }

  // Another person's card: by the minute, then by the total within a day. Only ever a question, and only the office's.
  const others = pool.filter((c) => !isOwn(t, c))
  const otherByMinute = others.filter((c) => inMinuteWindow(t, c))
  const otherFit = otherByMinute.length > 0 ? otherByMinute : others.filter((c) => t.takenAtFrom !== 'none' && sameAmount(c, t.total) && Math.abs(c.swipeAtMs - t.takenAtMs) <= TICKET_TOTAL_WINDOW_MS)
  const narrowed = otherFit.length > 1 && t.total !== null ? otherFit.filter((c) => sameAmount(c, t.total)) : otherFit
  const pick = narrowed.length > 0 ? narrowed : otherFit
  if (pick.length === 1) return { kind: 'ask', who: 'office', why: 'other_card', chargeId: pick[0]!.id }
  if (pick.length > 1) return { kind: 'none', why: 'several_fit', chargeIds: pick.map((c) => c.id) }
  return { kind: 'none', why: 'no_charge', chargeIds: [] }
}

/** One ticket against the charges: the answer for a ticket taken alone. */
export function matchTicket(ticket: MatchTicket, charges: readonly MatchCharge[]): TicketMatch {
  const pool = candidates(ticket, charges, new Set())
  return madeMatch(ticket, pool) ?? looseMatch(ticket, pool)
}

/**
 * Every open ticket against the charges, as one answer a ticket id. A charge goes to one ticket: the matches made with
 * no press are settled first, oldest ticket first and again until nothing changes, so a ticket that fits two swipes
 * takes the one the other ticket left. A question never holds a charge: two tickets may ask about one, and the first
 * Yes takes it.
 */
export function matchTickets(tickets: readonly MatchTicket[], charges: readonly MatchCharge[]): Map<string, TicketMatch> {
  const order = [...tickets].sort((a, b) => a.takenAtMs - b.takenAtMs || a.id.localeCompare(b.id))
  const out = new Map<string, TicketMatch>()
  const claimed = new Set<string>()
  let changed = true
  while (changed) {
    changed = false
    for (const t of order) {
      if (out.has(t.id)) continue
      const made = madeMatch(t, candidates(t, charges, claimed))
      if (made) {
        out.set(t.id, made)
        claimed.add(made.chargeId)
        changed = true
      }
    }
  }
  for (const t of order) if (!out.has(t.id)) out.set(t.id, looseMatch(t, candidates(t, charges, claimed)))
  return out
}
