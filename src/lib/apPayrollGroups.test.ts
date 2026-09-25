import { describe, expect, it } from 'vitest'
import { groupPayrollStubItems, isPayrollPersonGroup, partitionApDrillItems, payrollWeekLabel } from './apPayrollGroups'
import {
  buildApBucket,
  buildApBucketFromAggregates,
  buildUpcomingApSection,
  mergeUpcomingIntoAp,
  redactApPayrollItems,
  upcomingApSectionFromAggregates,
  type FinancialItem,
} from './dashboardFinancials'

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

describe('partitionApDrillItems', () => {
  const supply = [{ id: 's1', amount: 250, invoice_date: '2026-06-15', supply_houses: { name: 'Ferguson' } }]
  const stubs = [
    { id: 'p1', person_name: 'Taunya', period_start: '2026-06-21', period_end: '2026-06-27', netPay: 900, paidSum: 400 },
    { id: 'p2', person_name: 'Bryan', period_start: '2026-06-14', period_end: '2026-06-20', netPay: 700, paidSum: 0 },
  ]
  const subLabor = [{ id: 'sl1', assignedToName: 'Ram Crew', address: null, jobNumber: '812', createdYmd: '2026-05-01', balance: 1200 }]
  const sectionTotal = (items: FinancialItem[]) => items.reduce((s, i) => s + i.amount, 0)

  it('puts per-person pay-report weeks under Team payroll', () => {
    const ap = partitionApDrillItems(buildApBucket(supply, stubs, subLabor).items)
    expect(ap.teamPayroll.map((i) => i.label).sort()).toEqual(['Bryan', 'Taunya'])
    expect(ap.subLabor.map((i) => i.key)).toEqual(['sublabor:sl1'])
    expect(ap.supplies.map((i) => i.key)).toEqual(['supply:s1'])
  })

  it('keeps an assistant’s one Payroll line — the redacted bucket (v2.3832)', () => {
    const bucket = redactApPayrollItems(buildApBucket(supply, stubs, subLabor))
    const ap = partitionApDrillItems(bucket.items)
    expect(ap.teamPayroll).toHaveLength(1)
    expect(ap.teamPayroll[0]?.key).toBe('payroll:aggregate')
    expect(ap.teamPayroll[0]?.amount).toBeCloseTo(1200)
    // Every dollar the footer counts is in a section.
    expect(sectionTotal([...ap.teamPayroll, ...ap.subLabor, ...ap.supplies])).toBeCloseTo(bucket.total)
  })

  it('keeps an assistant’s one Payroll line — the aggregates bucket (v2.3832)', () => {
    const bucket = buildApBucketFromAggregates(supply, { dueTotal: 500, dueCount: 3 }, subLabor)
    const ap = partitionApDrillItems(bucket.items)
    expect(ap.teamPayroll.map((i) => i.key)).toEqual(['payroll:aggregate'])
    expect(sectionTotal([...ap.teamPayroll, ...ap.subLabor, ...ap.supplies])).toBeCloseTo(bucket.total)
  })

  it('leaves the upcoming estimate out — it joins the drill-down as its own section', () => {
    const merged = mergeUpcomingIntoAp(
      buildApBucketFromAggregates(supply, { dueTotal: 500, dueCount: 3 }),
      upcomingApSectionFromAggregates({ upcomingTotal: 550, upcomingCount: 2 }),
    )
    const ap = partitionApDrillItems(merged.items)
    const keys = [...ap.teamPayroll, ...ap.subLabor, ...ap.supplies].map((i) => i.key)
    expect(keys.some((k) => k.startsWith('upcoming:'))).toBe(false)
    expect(sectionTotal([...ap.teamPayroll, ...ap.subLabor, ...ap.supplies])).toBeCloseTo(merged.total - merged.upcomingTotal)
    // The per-person estimate lines of a non-assistant bucket stay out too.
    const full = mergeUpcomingIntoAp(
      buildApBucket(supply, stubs),
      buildUpcomingApSection([{ personName: 'Bryan', weekStartYmd: '2026-06-28', weekEndYmd: '2026-07-04', hours: 8, estimatedGrossDollars: 200 }]),
    )
    expect(partitionApDrillItems(full.items).teamPayroll.every((i) => i.key.startsWith('stub:'))).toBe(true)
  })
})
