/**
 * Messages, cut 2's screens, PR D: Settings → Phone and texts → **Who gets a new message**. The seats the rule reads
 * (`app_settings.messages_assign_rule_v1`, cut 2's migration `20261012160000_messages_follow_up.sql`), parsed and said
 * the way the prototype's settings card says them (v1.178's `renderSettings`). `whoGetsIt` in `followUp/queue.ts` is the
 * rule itself: whoever answered the person last when they are here today, else the seat for who they are, else nobody.
 * The owner and a dev set the seats, as the setting's policy allows; the GC office team reads them.
 */
import type { UserRole } from '../../hooks/useAuth'
import { GC_OFFICE_TEAM } from '../gc/access'
import type { AssignRuleSeats } from '../followUp/assignSeats'

// The seats and their reading live in `followUp/assignSeats.ts`, light enough for the edge copy (R5's push).
export { NO_SEATS, parseAssignSeats, type AssignRuleSeats } from '../followUp/assignSeats'

export type SeatKind = 'customer' | 'trade' | 'arch'

/** The setting's text for the seats, the three keys always written. */
export function assignSeatsText(seats: AssignRuleSeats): string {
  return JSON.stringify({ customer: seats.customer, trade: seats.trade, arch: seats.arch })
}

export function sameSeats(a: AssignRuleSeats, b: AssignRuleSeats): boolean {
  return a.customer === b.customer && a.trade === b.trade && a.arch === b.arch
}

/** Who may change the seats: the owner and a dev (the setting's policy, `is_master_or_dev()`). */
export function canSetAssignSeats(role: UserRole | null | undefined): boolean {
  return role === 'master_technician' || role === 'dev'
}

/** Who sees Settings → Phone and texts: the GC office team, the people Follow up is for. */
export function canSeePhoneAndTexts(role: UserRole | null | undefined): boolean {
  return role != null && GC_OFFICE_TEAM.includes(role)
}

/** Who can sit in a seat: someone on the GC office team with a name, by name. */
export function seatOptions<T extends { id: string; name: string; role: string }>(team: readonly T[]): T[] {
  return team.filter((t) => t.name.trim() !== '' && (GC_OFFICE_TEAM as readonly string[]).includes(t.role)).sort((a, b) => a.name.localeCompare(b.name))
}

/** What a saved seat reads as when its person is no longer on the office team. */
export const SEAT_GONE = 'Someone no longer on the team'

export const SEAT_LABELS: Readonly<Record<SeatKind, string>> = { customer: 'Customers', trade: 'Trade partners', arch: 'Architects' }

/** The rule's first step, said before the seats. */
export const ASSIGN_RULE_FIRST = 'Whoever answered the person last gets it, when they are here today. Otherwise it goes by who they are.'

/** Said after the seats. */
export const ASSIGN_RULE_AFTER = 'The pill on the row says it came by the rule. Anyone can take it or hand it on.'

/** One line of the rule's table: who they are, and who gets it. */
export interface AssignRuleRow {
  key: SeatKind | 'unknown'
  who: string
  goesTo: string
}

const NOBODY = 'Nobody. Whoever answers first takes it.'

/** The rule's table with the seats' names, in the prototype's order. */
export function assignRuleRows(seats: AssignRuleSeats, nameOf: (userId: string) => string | null | undefined): AssignRuleRow[] {
  const name = (id: string | null) => (id ? nameOf(id)?.trim() || SEAT_GONE : null)
  const customer = name(seats.customer)
  const trade = name(seats.trade)
  const arch = name(seats.arch)
  return [
    { key: 'customer', who: 'A customer', goesTo: customer ?? NOBODY },
    { key: 'trade', who: 'A trade partner', goesTo: trade ?? NOBODY },
    { key: 'arch', who: 'An architect', goesTo: arch ?? (trade ? `${trade}, the trade partners' seat` : NOBODY) },
    { key: 'unknown', who: 'A number nobody knows', goesTo: NOBODY },
  ]
}

/** What the owner reads after the seats are saved. */
export const SEATS_SAVED_TOAST = 'Saved. New messages go by these seats from now on.'

/** What the owner reads when the save changed nothing: the policy refused it, or the setting is not there yet. */
export const SEATS_NOT_SAVED = 'The seats did not save. Only the owner or a dev can change them.'
