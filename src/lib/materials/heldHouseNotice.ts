/**
 * The houses' own notices on Materials → Held for suppliers (v2.4440). The Lien desk marks a
 * job only while money is owed to US; a job whose customer has paid in full never reaches it,
 * yet a supply house that is still owed there can send its own § 53.056 notice to that
 * customer. This is that case: per job, whether the customer has paid in full while a house's
 * window is still open, and the soonest such date.
 *
 * Pure. The house's date is `lienSupplierHouseNotice`: the day the house told us, else our
 * estimate from its unpaid invoice months.
 */

import { formatYmdMonthDay } from '../jobs/billedExpectedPay'
import { lienSupplierHouseNotice, type LienSupplierJob } from '../jobs/lienJobSuppliers'

const EPSILON = 0.005

export interface HeldNoticeRisk {
  /** The soonest day a house can act, 'YYYY-MM-DD'. */
  ymd: string
  house: string
  /** The house itself gave the day. */
  said: boolean
  /** What that house is owed on the job. */
  owed: number
  /** "Paid in full · Reece can send its own notice by Oct 15" */
  words: string
}

/** The customer has paid everything billed (and something was billed). */
export function customerPaidInFull(row: { billed: number; paidIn: number }): boolean {
  return row.billed > EPSILON && row.paidIn >= row.billed - EPSILON
}

/**
 * A paid-in-full job where a house that is still owed can still send its notice: the soonest
 * such house. Null when the customer still owes us (the Lien desk has the job), when no house
 * is owed, or when every house's window has closed.
 */
export function heldNoticeRisk(row: { billed: number; paidIn: number }, job: LienSupplierJob | null | undefined, propertyKind: string, todayYmd: string): HeldNoticeRisk | null {
  if (!job || job.owed <= EPSILON || !customerPaidInFull(row)) return null
  let first: HeldNoticeRisk | null = null
  for (const h of job.houses) {
    if (h.owed <= EPSILON) continue
    const n = lienSupplierHouseNotice(h, propertyKind, todayYmd)
    const ahead = n.kind === 'open' || (n.kind === 'said' && n.daysLeft >= 0)
    if (!ahead) continue
    if (first && first.ymd <= n.ymd) continue
    const said = n.kind === 'said'
    first = {
      ymd: n.ymd,
      house: h.name,
      said,
      owed: h.owed,
      words: said ? `Paid in full · ${h.name} says its notice goes out ${formatYmdMonthDay(n.ymd)}` : `Paid in full · ${h.name} can send its own notice by ${formatYmdMonthDay(n.ymd)}`,
    }
  }
  return first
}
