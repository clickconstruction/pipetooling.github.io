/** Payroll Forecast: the pay reports with a balance still owed, one row each, oldest first. */

import type { PayrollForecastUnpaidRow } from '../../components/pay/PayrollForecastModal'
import { isPayStubFullyPaid } from '../payStubPayments'
import { payStubBalance, type PayStubLineMaps } from './recordPayStubPayment'

export type ForecastStub = { id: string; person_name: string; period_end: string; gross_pay: number }

/**
 * Unpaid pay-stub rows surfaced into the Payroll Forecast modal.
 * Same net-pay math the Ledger summary uses, but emits one row per
 * stub instead of aggregate counts. Sorted by oldest balance first
 * so the most urgent obligations show at the top of the table — the
 * forecast UX is "which old balances will this incoming bar cover?"
 * A report paid to within a cent is left out.
 */
export function payrollForecastUnpaidRows(payStubs: readonly ForecastStub[], maps: PayStubLineMaps): PayrollForecastUnpaidRow[] {
  const rows: PayrollForecastUnpaidRow[] = []
  for (const stub of payStubs) {
    const { netPay, paidSoFar, remaining: rem } = payStubBalance(stub, maps)
    if (isPayStubFullyPaid(netPay, paidSoFar)) continue
    if (rem <= 0) continue
    rows.push({
      stubId: stub.id,
      personName: stub.person_name,
      // `period_end` reads naturally as "balance from this date" — it
      // marks when the work was complete and the obligation crystallized.
      balanceCreatedYmd: stub.period_end,
      remaining: rem,
    })
  }
  rows.sort((a, b) => {
    if (a.balanceCreatedYmd !== b.balanceCreatedYmd) {
      return a.balanceCreatedYmd < b.balanceCreatedYmd ? -1 : 1
    }
    return a.personName.localeCompare(b.personName)
  })
  return rows
}
