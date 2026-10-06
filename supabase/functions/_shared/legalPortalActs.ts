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
 *   - who recorded it (`meta.recordedBy` = { id, name } from the firm's own list).
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
