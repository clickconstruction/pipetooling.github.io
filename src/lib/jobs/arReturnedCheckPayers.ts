/**
 * The payer remembers a check that came back (v2.4328, punch list #76 PR 4).
 *
 * `list_ar_returned_check_payers` returns, for every check that came back in the last
 * year, the jobs and bills it touched with their party fields. The payer of each is the
 * one who-pays rule the app already has (`payerCustomerId` over `effectiveInvoiceParty`),
 * so a GC's bounced check counts against the GC, not the homeowner on the same job.
 * The Billed row's pay history then says "2 checks came back · Apr". Pure; tested beside it.
 */
import { effectiveInvoiceParty, payerCustomerId } from './billToParty'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

export type ArReturnedCheckPayerRow = {
  mercury_transaction_id: string
  came_back_at: string | null
  job_id: string
  job_customer_id: string | null
  job_gc_customer_id: string | null
  job_bill_to_party: string | null
  invoice_bill_to_party: string | null
  invoice_bill_to_email: string | null
}

export type PayerReturns = { count: number; lastYmd: string | null }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Payer customer id → how many distinct checks of theirs came back, and the latest day. */
export function arReturnsByPayer(rows: ReadonlyArray<ArReturnedCheckPayerRow>): Map<string, PayerReturns> {
  const seen = new Map<string, { txs: Set<string>; lastYmd: string | null }>()
  for (const r of rows) {
    const job = { bill_to_party: r.job_bill_to_party, gc_customer_id: r.job_gc_customer_id, customer_id: r.job_customer_id }
    const payer = payerCustomerId(job, effectiveInvoiceParty(job, { bill_to_party: r.invoice_bill_to_party, bill_to_email: r.invoice_bill_to_email }))
    if (!payer) continue
    // came_back_at is an instant: its day in APP_CALENDAR_TZ, not its UTC date.
    const ymd = calendarYmdInAppTzFromIso(String(r.came_back_at ?? '')) || null
    const g = seen.get(payer) ?? { txs: new Set<string>(), lastYmd: null }
    g.txs.add(r.mercury_transaction_id)
    if (ymd && (!g.lastYmd || ymd > g.lastYmd)) g.lastYmd = ymd
    seen.set(payer, g)
  }
  const out = new Map<string, PayerReturns>()
  for (const [payer, g] of seen) out.set(payer, { count: g.txs.size, lastYmd: g.lastYmd })
  return out
}

/** "2 checks came back · Apr", "1 check came back · Jul 2025". */
export function payerReturnsWords(r: PayerReturns | null | undefined, todayYmd: string): string | null {
  if (!r || r.count <= 0) return null
  const m = /^(\d{4})-(\d{2})/.exec(r.lastYmd ?? '')
  const month = m ? MONTHS[Number(m[2]) - 1] ?? '' : ''
  const when = m ? (m[1] === todayYmd.slice(0, 4) ? month : `${month} ${m[1]}`) : ''
  return `${r.count} check${r.count === 1 ? '' : 's'} came back${when ? ` · ${when}` : ''}`
}
