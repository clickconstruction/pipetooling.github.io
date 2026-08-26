/**
 * Kernel for the Data health inline bill-date editor (v2.2316): the
 * "＋ add date" field takes six digits as MM/DD/YY — slashes fill themselves
 * in as the user types, and the field is sized to hug exactly what's been
 * typed. Parsing is strict: only a complete, real calendar date saves.
 */

export const BILL_DATE_PLACEHOLDER = 'MM/DD/YY'

/** Digits-only input → progressive MM/DD/YY (slashes auto-inserted, 6-digit cap). */
export function formatBillDateInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 6)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

/** Exact-fit field width in ch: hugs the typed text, never below placeholder width. */
export function billDateInputWidthCh(value: string): number {
  return Math.max(value.length, BILL_DATE_PLACEHOLDER.length)
}

/** Complete MM/DD/YY → 'YYYY-MM-DD' (years are 20YY); null unless a real calendar date. */
export function parseBillDateInput(value: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(value)
  if (!m) return null
  const month = Number(m[1])
  const day = Number(m[2])
  const year = 2000 + Number(m[3])
  if (month < 1 || month > 12 || day < 1) return null
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day > daysInMonth) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * YMD → the timestamptz to store in jobs_ledger_invoices.billed_at.
 * 18:00 UTC is noon CST / 1pm CDT, so the company-timezone date the pay-speed
 * RPC derives from it always equals the typed date, DST either way.
 */
export function billedAtIsoFromYmd(ymd: string): string {
  return `${ymd}T18:00:00.000Z`
}
