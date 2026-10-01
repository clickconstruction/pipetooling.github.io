/**
 * A check takes days to clear (v2.4330, punch list #76 PR 5). The bank can still send it
 * back after the bill reads paid: every real return in 19 months of prod came back within
 * six days of posting. An unconditional lien waiver holds whether or not the check does,
 * so the waiver cell waits until a check on the bill has cleared before it asks for one.
 *
 * Owner's call 2026-10-01: seven days. A card, a bank transfer or cash does not wait.
 * Pure; tested beside it.
 */
import { ymdAddDays } from '../../utils/dateUtils'

/** Days after a check is paid before the unconditional waiver is asked for. */
export const CHECK_CLEAR_DAYS = 7

export type ClearingPayment = {
  invoice_id: string | null
  amount: number | string | null
  paid_on: string | null
  payment_type: string | null
}

/** "Check", "Cheque", "checkDeposit" (Accounts Receivable's kind), "ck". */
export function isCheckPayment(p: { payment_type?: string | null }): boolean {
  return /check|cheque|\bck\b/i.test(p.payment_type ?? '')
}

/**
 * The day the newest check on this bill clears, or null when no check on it is still
 * clearing (none was paid by check, or the last one is `days` old).
 */
export function billCheckClearsYmd(invoiceId: string, payments: ReadonlyArray<ClearingPayment>, todayYmd: string, days: number = CHECK_CLEAR_DAYS): string | null {
  let latest: string | null = null
  for (const p of payments) {
    if (p.invoice_id !== invoiceId || !isCheckPayment(p) || !((Number(p.amount) || 0) > 0)) continue
    const ymd = (p.paid_on ?? '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue
    if (!latest || ymd > latest) latest = ymd
  }
  if (!latest) return null
  const clears = ymdAddDays(latest, days)
  return clears > todayYmd ? clears : null
}

/**
 * v2.4333: a check deposit applied to bills that has not cleared yet — "clears about Oct 8" on
 * its Accounts Receivable row. The deposit's posting day (the company calendar) plus `days`;
 * null for anything but a check deposit, one nothing was applied from, or one that has cleared.
 */
export function depositClearsYmd(
  d: { kind?: string | null; posted_at?: string | null; consumed?: number | string | null },
  postedYmd: string | null,
  todayYmd: string,
  days: number = CHECK_CLEAR_DAYS,
): string | null {
  if ((d.kind ?? '') !== 'checkDeposit' || !((Number(d.consumed) || 0) > 0) || !postedYmd) return null
  const clears = ymdAddDays(postedYmd, days)
  return clears > todayYmd ? clears : null
}
