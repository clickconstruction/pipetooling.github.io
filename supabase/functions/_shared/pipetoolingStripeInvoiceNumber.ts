/** PipeTooling Stripe invoice number: digits-only HCP + `-` + YYMMDD from due date + HHmm in APP_CALENDAR_TZ (America/Chicago). Example: `11-2605140020` (Stripe often shows `#` in emails). */

import { APP_CALENDAR_TZ } from './appTimeZone.ts'

export const PIPETOOLING_STRIPE_INVOICE_NUMBER_HCP_ERROR =
  'Job must have an HCP number (digits) to create a Stripe invoice with this numbering scheme.'

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export type PipetoolingStripeInvoiceNumberResult =
  | { ok: true; number: string }
  | { ok: false; error: string }

function isValidYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** 24-hour HHmm in company calendar TZ at `issuedAtMs` (Unix ms). */
export function formatChicagoHHmm(issuedAtMs: number): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  })
  const parts = fmt.formatToParts(new Date(issuedAtMs))
  let hour = ''
  let minute = ''
  for (const p of parts) {
    if (p.type === 'hour') hour = p.value
    if (p.type === 'minute') minute = p.value
  }
  return `${hour.padStart(2, '0')}${minute.padStart(2, '0')}`
}

/**
 * @param hcpRaw - `jobs_ledger.hcp_number`; non-digits stripped
 * @param dueDateYmd - Bill due date `YYYY-MM-DD` (trimmed by caller or here)
 * @param issuedAtMs - Instant for Chicago HHmm suffix; defaults to `Date.now()` when omitted
 */
export function buildPipetoolingStripeInvoiceNumber(
  hcpRaw: string | null | undefined,
  dueDateYmd: string,
  issuedAtMs: number = Date.now(),
): PipetoolingStripeInvoiceNumberResult {
  const trimmed = dueDateYmd.trim()
  const m = YMD_RE.exec(trimmed)
  if (!m) {
    return { ok: false, error: 'Invalid due date; expected YYYY-MM-DD.' }
  }
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!isValidYmd(y, mo, d)) {
    return { ok: false, error: 'Invalid due date; not a real calendar day.' }
  }
  const hcpDigits = (hcpRaw ?? '').replace(/\D/g, '')
  if (!hcpDigits) {
    return { ok: false, error: PIPETOOLING_STRIPE_INVOICE_NUMBER_HCP_ERROR }
  }
  const yy = String(y).slice(-2).padStart(2, '0')
  const mm = String(mo).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  const hhmm = formatChicagoHHmm(issuedAtMs)
  return { ok: true, number: `${hcpDigits}-${yy}${mm}${dd}${hhmm}` }
}
