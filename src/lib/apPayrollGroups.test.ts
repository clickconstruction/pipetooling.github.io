import { describe, expect, it } from 'vitest'
import { groupPayrollStubItems, isPayrollPersonGroup, payrollWeekLabel } from './apPayrollGroups'
import type { FinancialItem } from './dashboardFinancials'

const stub = (label: string, amount: number, dateYmd: string | null, key = `stub:${label}:${dateYmd}`): FinancialItem => ({
  key,
  label,
  sublabel: dateYmd ? `Payroll 2026-01-01 – ${dateYmd}` : 'Payroll',
  amount,
  dateYmd,
  jobId: null,
  address: null,
})

describe('groupPayrollStubItems', () => {
  it('collapses 2+ weeks per person into a group; single weeks stay flat', () => {
    const rows = groupPayrollStubItems(
      [stub('Malachi', 2309, '2026-08-08'), stub('Malachi', 1509, '2026-06-27'), stub('Taunya', 667, '2026-08-01')],
      'amount'
    )
    expect(rows).toHaveLength(2)
    const group = rows.find(isPayrollPersonGroup)
    expect(group?.label).toBe('Malachi')
    expect(group?.total).toBe(3818)
    expect(group?.oldestDateYmd).toBe('2026-06-27')
    expect(group?.weeks.map((w) => w.dateYmd)).toEqual(['2026-06-27', '2026-08-08'])
    const single = rows.find((r) => !isPayrollPersonGroup(r))
    expect(single?.label).toBe('Taunya')
  })

  it("sort 'amount' orders by group total vs flat amount, biggest first", () => {
    const rows = groupPayrollStubItems(
      [stub('A', 500, '2026-08-01'), stub('A', 600, '2026-08-08'), stub('B', 900, '2026-07-01')],
      'amount'
    )
    expect(rows.map((r) => r.label)).toEqual(['A', 'B'])
  })

  it("sort 'oldest' orders by oldest week, undated last", () => {
    const rows = groupPayrollStubItems(
      [stub('A', 500, '2026-08-01'), stub('A', 600, '2026-08-08'), stub('B', 900, '2026-07-01'), stub('C', 100, null)],
      'oldest'
    )
    expect(rows.map((r) => r.label)).toEqual(['B', 'A', 'C'])
  })

  it('empty input → empty output', () => {
    expect(groupPayrollStubItems([], 'amount')).toEqual([])
  })
})

describe('payrollWeekLabel', () => {
  it('strips the "Payroll " prefix and falls back to a dash', () => {
    expect(payrollWeekLabel(stub('A', 1, '2026-08-08'))).toBe('2026-01-01 – 2026-08-08')
    expect(payrollWeekLabel({ ...stub('A', 1, null), sublabel: null })).toBe('—')
  })
})
