/**
 * The guards on the firm's acts (punch list #85, item 18) — pure, shared by
 * `submit-legal-portal` and the page (`src/pages/LegalPortal.tsx`) so the two
 * never disagree on a date, a key or the hourly limit.
 *
 *   - the date the firm sets (`occurredOn`): a real day, not in the future,
 *     not more than three years back;
 *   - the one-time key per act (`clientId`, a uuid): a retry or a double click
 *     saves once;
 *   - the hourly limit: 60 acts per matter, and the refusal names the matter
 *     and the time it lifts;
 *   - the cap on confirmation emails: three to a person and twenty-four to a firm
 *     in an hour, and the refusal says which;
 *   - who recorded it (`meta.recordedBy` = { id, name } from the firm's own list);
 *   - undo with a reason (PR 2): which entries each side may void, and that a
 *     voided entry leaves every total.
 */

export const LEGAL_ACTS_PER_MATTER_PER_HOUR = 60

const YMD = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function ymdValid(ymd: string): boolean {
  if (!YMD.test(ymd)) return false
  const d = new Date(`${ymd}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd
}

/** Why a date the firm typed cannot be saved; null when it can. */
export function legalActDateProblem(occurredOn: string, todayYmd: string): string | null {
  if (!ymdValid(occurredOn)) return 'Pick a date.'
  if (occurredOn > todayYmd) return 'The date cannot be in the future.'
  const floor = `${Number(todayYmd.slice(0, 4)) - 3}${todayYmd.slice(4)}`
  if (occurredOn < floor) return 'That date is more than three years back. Ask the office to record it.'
  return null
}

/**
 * Why a day the firm planned a step for cannot be saved (v2.5800); null when it can. A planned step may sit in the
 * future, unlike the firm's other acts, but not more than three years either way.
 */
export function legalPlanDateProblem(plannedOn: string, todayYmd: string): string | null {
  if (!ymdValid(plannedOn)) return 'Pick the day it is planned for.'
  const year = Number(todayYmd.slice(0, 4))
  if (plannedOn < `${year - 3}${todayYmd.slice(4)}`) return 'That day is more than three years back. Ask the office to record it.'
  if (plannedOn > `${year + 3}${todayYmd.slice(4)}`) return 'That day is more than three years ahead.'
  return null
}

export function isLegalClientId(v: unknown): v is string {
  return typeof v === 'string' && UUID.test(v)
}

/** The refusal when a matter hits the hourly limit: the matter's name and when it lifts (`retryAt`, a clock time in the company zone). */
export function legalRateLimitMessage(payerName: string, retryAt: string | null): string {
  const who = payerName.trim() || 'this matter'
  return `${LEGAL_ACTS_PER_MATTER_PER_HOUR} changes on ${who} in the last hour is the limit.${retryAt ? ` Try again after ${retryAt}.` : ' Try again in an hour.'}`
}

/**
 * The cap on confirmation emails (punch list #85, a review residual). Adding a person and *Resend the
 * confirmation* each send one email from the company's own address, and the firm's link is all a caller
 * needs, so before the cap a caller could have the company send them without end.
 *
 * The count is the portal's own throttle, `legal_portal_guess_gate` (`_shared/legalPortalGuessGate.ts`): the
 * same hour-long count that slows a guesser, kept under a key for the person and a key for the firm in place
 * of a caller's address. A person is sent three in an hour, their first and two more. A firm is sent
 * twenty-four in an hour, its whole list of twelve twice over. A missing count reads as none, as the
 * guess gate reads it, so the portal never closes on a throttle that cannot answer.
 */
export const LEGAL_CONFIRMS_PER_PERSON_PER_HOUR = 3
export const LEGAL_CONFIRMS_PER_FIRM_PER_HOUR = 24

/** The throttle's keys for a confirmation. No caller's address can equal one: an address has no `confirm` in front. */
export function legalConfirmCapKeys(firmId: string, recipientId: string | null): { firm: string; person: string | null } {
  return { firm: `confirm-firm:${firmId}`, person: recipientId ? `confirm:${recipientId}` : null }
}

/**
 * Why one more confirmation cannot go now; null when it can. Each count is how many went in the last hour
 * before this one. The person's limit is said first: it is the one a second press on Resend reaches.
 */
export function legalConfirmCapProblem(sent: { toPerson: number; fromFirm: number }, email: string): string | null {
  if (sent.toPerson >= LEGAL_CONFIRMS_PER_PERSON_PER_HOUR) return `${LEGAL_CONFIRMS_PER_PERSON_PER_HOUR} confirmation emails to ${email.trim() || 'this person'} in the last hour is the limit. Try again in an hour.`
  if (sent.fromFirm >= LEGAL_CONFIRMS_PER_FIRM_PER_HOUR) return `${LEGAL_CONFIRMS_PER_FIRM_PER_HOUR} confirmation emails to your firm in the last hour is the limit. Try again in an hour.`
  return null
}

/**
 * The cap, asked of the throttle in two steps. `count(key, record)` answers how many are under a key in the
 * last hour, after adding this one when `record` is set.
 *
 * First without recording: a press the cap refuses is never counted, so pressing again cannot push the hour
 * out. Then recorded and read back: of presses that passed the first step together, the ones over the limit
 * are refused, and what they recorded only keeps the hour closed. `recipientId` is null when the person is
 * being added and has no key yet; the caller records their first one once the row exists.
 */
export async function askLegalConfirmCap(count: (key: string, record: boolean) => Promise<number>, firmId: string, recipientId: string | null, email: string): Promise<string | null> {
  const keys = legalConfirmCapKeys(firmId, recipientId)
  const read = async (record: boolean): Promise<{ toPerson: number; fromFirm: number }> => {
    const [toPerson, fromFirm] = await Promise.all([keys.person ? count(keys.person, record) : Promise.resolve(record ? 1 : 0), count(keys.firm, record)])
    // Once recorded, each count holds this one too.
    return record ? { toPerson: toPerson - 1, fromFirm: fromFirm - 1 } : { toPerson, fromFirm }
  }
  return legalConfirmCapProblem(await read(false), email) ?? legalConfirmCapProblem(await read(true), email)
}

/** The refusal when the same person's confirmation was asked for twice in one instant: one went, and this press is told so. */
export function legalConfirmTwinMessage(email: string): string {
  return `A confirmation email to ${email.trim() || 'this person'} went a moment ago. Check that inbox before sending another.`
}

export type LegalRecordedBy = { id: string; name: string }

/** Who at the firm recorded an act — `meta.recordedBy`; null on an older act or an office entry. */
export function recordedByOf(meta: unknown): LegalRecordedBy | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const r = (meta as Record<string, unknown>).recordedBy
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null
  const id = (r as Record<string, unknown>).id
  const name = (r as Record<string, unknown>).name
  return typeof id === 'string' && typeof name === 'string' && name.trim() ? { id, name: name.trim() } : null
}

type VoidableEntry = { kind: string; via_portal: boolean; voided_at?: string | null; acknowledged_at?: string | null }

/** Undone (#85 item 18): the entry stays in the stream, struck through, and leaves every total. */
export function isVoidedEntry(e: { voided_at?: string | null }): boolean {
  return Boolean(e.voided_at)
}

/**
 * Why the firm cannot undo this entry; null when it can. The firm undoes its own fees and costs, and a payment
 * it reported that the office has not applied yet. A step is corrected by recording the right step; anything
 * else is the office's, and the firm asks in the conversation.
 */
export function firmVoidProblem(e: VoidableEntry): string | null {
  if (!e.via_portal) return 'That entry is the office’s. Ask them in the conversation.'
  if (e.voided_at) return 'Already undone.'
  if (e.kind === 'fee' || e.kind === 'cost') return null
  if (e.kind === 'payment_received') return e.acknowledged_at ? 'The office already applied that payment. Ask them in the conversation.' : null
  // v2.5800: the firm undoes a step it planned on the timeline.
  if (e.kind === 'plan') return null
  if (e.kind === 'step') return 'Record the right step instead.'
  return 'That entry cannot be undone.'
}

/** True when the firm already undid this entry through its portal for the same reason: a retry, answered ok. */
export function voidIsRetry(e: { voided_at: string | null; voided_via_portal?: boolean | null; void_reason?: string | null }, reason: string): boolean {
  return Boolean(e.voided_at) && e.voided_via_portal === true && (e.void_reason ?? '').trim() === reason.trim()
}

/** The office undoes the fees, costs, notes, planned steps and statements it wrote (`legal_void_entry` holds the same rule; planned steps since v2.5800, statements since v2.6209). */
export function officeCanVoid(e: VoidableEntry): boolean {
  return !e.via_portal && !e.voided_at && (e.kind === 'fee' || e.kind === 'cost' || e.kind === 'note' || e.kind === 'plan' || e.kind === 'statement')
}
