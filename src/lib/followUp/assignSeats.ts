/**
 * Messages, cut 2: *Who gets a new message*, the rule and its seats, light enough for the edge copy
 * (`scripts/edge-kernels.mjs`), so `messages-notify` (R5's push) reads them as the screens do. The seats are
 * `app_settings.messages_assign_rule_v1` (cut 2's migration `20261012160000_messages_follow_up.sql`). Moved here from
 * `followUp/queue.ts` and `messages/assignRule.ts`, which re-export them, since both import code the edge cannot take.
 * Nothing here imports but a type.
 */
import type { ContactKind } from '../contacts/names'

/** The `app_settings` key that holds the seats. `APP_SETTINGS_KEY_MESSAGES_ASSIGN_RULE_V1` is the client's copy. */
export const ASSIGN_RULE_KEY = 'messages_assign_rule_v1'

/** The seats *Who gets a new message* reads (Settings → Phone and texts). */
export interface AssignSeats {
  /** The assistant's seat. */
  customer: string | null
  /** The estimator's seat, which an architect shares unless set. */
  trade: string | null
  arch?: string | null
}

/** The three seats, each a user's id or nobody. An architect's seat left empty shares the trade partners' seat. */
export type AssignRuleSeats = Required<AssignSeats>

export const NO_SEATS: AssignRuleSeats = { customer: null, trade: null, arch: null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const seatOf = (v: unknown): string | null => (typeof v === 'string' && UUID.test(v.trim()) ? v.trim() : null)

/** The seats as the setting keeps them. Anything it cannot read is an empty seat, so a bad value sends nothing astray. */
export function parseAssignSeats(valueText: string | null | undefined): AssignRuleSeats {
  if (!valueText?.trim()) return { ...NO_SEATS }
  let parsed: unknown
  try {
    parsed = JSON.parse(valueText)
  } catch {
    return { ...NO_SEATS }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...NO_SEATS }
  const o = parsed as Record<string, unknown>
  return { customer: seatOf(o.customer), trade: seatOf(o.trade), arch: seatOf(o.arch) }
}

/**
 * Who gets a new message, by the rule (proposed in the prototype, the owner's call): whoever answered this person
 * last, when they are here today; else the seat for who they are. A number nobody knows goes to nobody, so whoever
 * answers first takes it.
 */
export function whoGetsIt(input: { kind: ContactKind; answeredLastBy: string | null; hereToday: ReadonlySet<string>; seats: AssignSeats }): string | null {
  if (input.answeredLastBy && input.hereToday.has(input.answeredLastBy)) return input.answeredLastBy
  if (input.kind === 'customer') return input.seats.customer
  if (input.kind === 'trade') return input.seats.trade
  if (input.kind === 'arch') return input.seats.arch ?? input.seats.trade
  return null
}
