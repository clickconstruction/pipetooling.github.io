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

export function isLegalClientId(v: unknown): v is string {
  return typeof v === 'string' && UUID.test(v)
}

/** The refusal when a matter hits the hourly limit: the matter's name and when it lifts (`retryAt`, a clock time in the company zone). */
export function legalRateLimitMessage(payerName: string, retryAt: string | null): string {
  const who = payerName.trim() || 'this matter'
  return `${LEGAL_ACTS_PER_MATTER_PER_HOUR} changes on ${who} in the last hour is the limit.${retryAt ? ` Try again after ${retryAt}.` : ' Try again in an hour.'}`
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
  if (e.kind === 'step') return 'Record the right step instead.'
  return 'That entry cannot be undone.'
}

/** True when the firm already undid this entry through its portal for the same reason: a retry, answered ok. */
export function voidIsRetry(e: { voided_at: string | null; voided_via_portal?: boolean | null; void_reason?: string | null }, reason: string): boolean {
  return Boolean(e.voided_at) && e.voided_via_portal === true && (e.void_reason ?? '').trim() === reason.trim()
}

/** The office undoes the fees, costs and notes it wrote (`legal_void_entry` holds the same rule). */
export function officeCanVoid(e: VoidableEntry): boolean {
  return !e.via_portal && !e.voided_at && (e.kind === 'fee' || e.kind === 'cost' || e.kind === 'note')
}
