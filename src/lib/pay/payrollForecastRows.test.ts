import { describe, expect, it } from 'vitest'
import { payrollForecastUnpaidRows } from './payrollForecastRows'
import type { PayStubLineMaps } from './recordPayStubPayment'

const stub = (id: string, person_name: string, period_end: string, gross_pay: number) => ({ id, person_name, period_end, gross_pay })
const paid = (pay_stub_id: string, amount: number) => ({ id: `p-${pay_stub_id}-${amount}`, pay_stub_id, amount, paid_at: '2026-09-25', memo: null, created_at: null, created_by: null })
const less = (pay_stub_id: string, amount: number) => ({ id: `d-${pay_stub_id}`, pay_stub_id, amount, source: 'manual' as const, person_offset_id: null, description: 'Less', created_at: null, created_by: null })

function maps(overrides: Partial<PayStubLineMaps> = {}): PayStubLineMaps {
  return { paymentsByStubId: {}, deductionsByStubId: {}, additionalByStubId: {}, ...overrides }
}

describe('payrollForecastUnpaidRows', () => {
  it('is one row per report with a balance, carrying what is left', () => {
    const rows = payrollForecastUnpaidRows(
      [stub('s1', 'Alex', '2026-09-19', 1000)],
      maps({ paymentsByStubId: { s1: [paid('s1', 400)] }, deductionsByStubId: { s1: [less('s1', 100)] } }),
    )
    expect(rows).toEqual([{ stubId: 's1', personName: 'Alex', balanceCreatedYmd: '2026-09-19', remaining: 500 }])
  })

  it('leaves out a report that is paid, or paid to within a cent', () => {
    const rows = payrollForecastUnpaidRows(
      [stub('full', 'Alex', '2026-09-19', 1000), stub('cent', 'Sam', '2026-09-19', 1000), stub('open', 'Jo', '2026-09-19', 1000)],
      maps({ paymentsByStubId: { full: [paid('full', 1000)], cent: [paid('cent', 999.99)] } }),
    )
    expect(rows.map((r) => r.stubId)).toEqual(['open'])
  })

  it('leaves out a report whose net pay is nothing', () => {
    const rows = payrollForecastUnpaidRows([stub('s1', 'Alex', '2026-09-19', 200)], maps({ deductionsByStubId: { s1: [less('s1', 200)] } }))
    expect(rows).toEqual([])
  })

  it('puts the oldest balance first, then the name', () => {
    const rows = payrollForecastUnpaidRows(
      [stub('a', 'Sam', '2026-09-19', 100), stub('b', 'Alex', '2026-09-19', 100), stub('c', 'Zed', '2026-09-12', 100), stub('d', 'Alex', '2026-09-26', 100)],
      maps(),
    )
    expect(rows.map((r) => `${r.balanceCreatedYmd} ${r.personName}`)).toEqual(['2026-09-12 Zed', '2026-09-19 Alex', '2026-09-19 Sam', '2026-09-26 Alex'])
  })

  it('is empty with no reports', () => {
    expect(payrollForecastUnpaidRows([], maps())).toEqual([])
  })
})
