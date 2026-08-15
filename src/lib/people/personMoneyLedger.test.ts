import { describe, expect, it } from 'vitest'
import {
  buildOffsetPaymentTimeline,
  buildPayStatementHtml,
  buildPayStatementPayments,
  offsetSignedAmount,
  paidTotalInRange,
  personOffsetBalances,
  uncoveredApprovedWeeks,
  buildSettleUpBoard,
  buildWeeklyHistoryGroups,
  personSettleUp,
  priceUncoveredWeeks,
  type PayStubLike,
  type PersonOffsetLike,
} from './personMoneyLedger'

function offset(over: Partial<PersonOffsetLike>): PersonOffsetLike {
  return { id: 'o1', person_name: 'Abraham', type: 'backcharge', amount: 100, description: null, occurred_date: '2026-08-01', pay_stub_id: null, ...over }
}

function stub(over: Partial<PayStubLike>): PayStubLike {
  return { id: 's1', person_name: 'Abraham', period_start: '2026-07-28', period_end: '2026-08-03', hours_total: 41.5, gross_pay: 1840, paid_at: '2026-08-08T15:00:00Z', ...over }
}

describe('offset signs and balances', () => {
  it('credits count for, charges against', () => {
    expect(offsetSignedAmount('employee_credit', 100)).toBe(100)
    expect(offsetSignedAmount('backcharge', 100)).toBe(-100)
    expect(offsetSignedAmount('damage', 425)).toBe(-425)
  })
  it('splits pending from lifetime and sorts most-negative pending first, settled last', () => {
    const rows = personOffsetBalances([
      offset({ id: 'a', person_name: 'Abraham', type: 'damage', amount: 425 }),
      offset({ id: 'b', person_name: 'Abraham', type: 'employee_credit', amount: 100, pay_stub_id: 'stub' }),
      offset({ id: 'c', person_name: 'Trace', type: 'employee_credit', amount: 150 }),
      offset({ id: 'd', person_name: 'Malachi', type: 'backcharge', amount: 50, pay_stub_id: 'stub' }),
    ])
    expect(rows.map((r) => r.personName)).toEqual(['Abraham', 'Trace', 'Malachi'])
    expect(rows[0]).toEqual({ personName: 'Abraham', pendingNet: -425, pendingCount: 1, lifetimeNet: -325 })
    expect(rows[1]).toEqual({ personName: 'Trace', pendingNet: 150, pendingCount: 1, lifetimeNet: 150 })
    expect(rows[2]).toEqual({ personName: 'Malachi', pendingNet: 0, pendingCount: 0, lifetimeNet: -50 })
  })
})

describe('buildOffsetPaymentTimeline', () => {
  it('interleaves offsets and payments newest first, flagging pending payments', () => {
    const rows = buildOffsetPaymentTimeline({
      offsets: [
        offset({ id: 'a', occurred_date: '2026-08-12', type: 'damage', amount: 425, description: 'Cracked windshield' }),
        offset({ id: 'b', occurred_date: '2026-07-30', type: 'employee_credit', amount: 100, description: 'Referral bonus', pay_stub_id: 's0' }),
      ],
      payStubs: [
        stub({ id: 's1' }),
        stub({ id: 's2', period_start: '2026-08-04', period_end: '2026-08-10', paid_at: null, gross_pay: 1795 }),
      ],
    })
    expect(rows.map((r) => [r.kind, r.dateYmd, r.amount])).toEqual([
      ['offset', '2026-08-12', -425],
      ['payment_pending', '2026-08-10', 1795],
      ['payment', '2026-08-08', 1840],
      ['offset', '2026-07-30', 100],
    ])
    expect(rows[0]?.label).toBe('Cracked windshield')
    expect(rows[0]?.applied).toBe(false)
    expect(rows[3]?.applied).toBe(true)
  })
})

describe('pay statement build', () => {
  const workDays = [
    { workDate: '2026-07-28', hours: 8, jobLabel: 'Terrell Road sewer repair' },
    { workDate: '2026-07-29', hours: 8, jobLabel: 'Terrell Road sewer repair' },
    { workDate: '2026-07-31', hours: 6, jobLabel: 'Shearer pinpoint' },
    { workDate: '2026-08-05', hours: 8, jobLabel: 'Outside the period' },
  ]
  it('groups the paid period days by job and attaches applied offsets', () => {
    const payments = buildPayStatementPayments({
      payStubs: [stub({ id: 's1' }), stub({ id: 's-unpaid', paid_at: null })],
      offsets: [offset({ id: 'a', pay_stub_id: 's1', type: 'damage', amount: 425, description: 'Windshield' })],
      workDays,
      rangeStart: null,
      rangeEnd: null,
    })
    expect(payments.length).toBe(1)
    expect(payments[0]?.jobLines).toEqual([
      { label: 'Terrell Road sewer repair', hours: 16 },
      { label: 'Shearer pinpoint', hours: 6 },
    ])
    expect(payments[0]?.offsets).toEqual([{ label: 'Windshield', amount: -425 }])
  })
  it('range-filters by paid date', () => {
    expect(
      buildPayStatementPayments({ payStubs: [stub({})], offsets: [], workDays: [], rangeStart: '2026-08-09', rangeEnd: null }).length,
    ).toBe(0)
  })
  it('renders the document with payments, job hours, offsets, and no revenue numbers', () => {
    const html = buildPayStatementHtml({
      personName: 'Abraham',
      companyName: 'Click Plumbing',
      rangeLabel: 'Jul 1 – Aug 14, 2026',
      payments: buildPayStatementPayments({
        payStubs: [stub({})],
        offsets: [offset({ id: 'a', pay_stub_id: 's1', type: 'damage', amount: 425, description: 'Windshield' })],
        workDays,
        rangeStart: null,
        rangeEnd: null,
      }),
      generatedYmd: '2026-08-14',
    })
    expect(html).toContain('Pay statement — Abraham')
    expect(html).toContain('Paid Aug 8, 2026 — $1,840.00')
    expect(html).toContain('Terrell Road sewer repair')
    expect(html).toContain('16 h')
    expect(html).toContain('Less: Windshield')
    expect(html).toContain('−$425.00')
    expect(html).not.toContain('billing')
    expect(html).not.toContain('revenue')
  })
})

describe('recorded payments (pay_stub_payments)', () => {
  const payments = [
    { id: 'p1', pay_stub_id: 's1', amount: 1000, paid_at: '2026-08-05T12:00:00Z', memo: 'cashapp' },
    { id: 'p2', pay_stub_id: 's1', amount: 840, paid_at: '2026-08-08T12:00:00Z', memo: null },
  ]
  it('timeline shows one row per recorded payment, dated by actual paid date', () => {
    const rows = buildOffsetPaymentTimeline({
      offsets: [],
      payStubs: [stub({ id: 's1', paid_at: null })],
      stubPayments: payments,
    })
    expect(rows.map((r) => [r.kind, r.dateYmd, r.amount])).toEqual([
      ['payment', '2026-08-08', 840],
      ['payment', '2026-08-05', 1000],
    ])
    expect(rows[1]?.label).toContain('cashapp')
  })
  it('partially paid reports show a remaining-balance pending row', () => {
    const rows = buildOffsetPaymentTimeline({
      offsets: [],
      payStubs: [stub({ id: 's1', paid_at: null })],
      stubPayments: [payments[0]!],
    })
    expect(rows.map((r) => [r.kind, r.amount])).toEqual([
      ['payment', 1000],
      ['payment_pending', 840],
    ])
    expect(rows[1]?.label).toContain('Balance remaining')
  })
  it('legacy paid_at-only stubs still show paid; payment rows win over legacy', () => {
    const rows = buildOffsetPaymentTimeline({
      offsets: [],
      payStubs: [stub({ id: 's1' })],
      stubPayments: payments,
    })
    expect(rows.filter((r) => r.kind === 'payment').length).toBe(2)
    expect(rows.reduce((s, r) => (r.kind === 'payment' ? s + r.amount : s), 0)).toBe(1840)
  })
  it('paidTotalInRange sums payments plus legacy-only stubs without double counting', () => {
    const total = paidTotalInRange({
      payStubs: [stub({ id: 's1' }), stub({ id: 's2', gross_pay: 500, paid_at: '2026-08-10T12:00:00Z' })],
      stubPayments: payments,
      rangeStart: null,
      rangeEnd: null,
    })
    expect(total).toBe(2340)
  })
  it('statement entries come from recorded payments, offsets listed once per report', () => {
    const entries = buildPayStatementPayments({
      payStubs: [stub({ id: 's1', paid_at: null })],
      offsets: [offset({ id: 'a', pay_stub_id: 's1', type: 'damage', amount: 425, description: 'Windshield' })],
      workDays: [],
      stubPayments: payments,
      rangeStart: null,
      rangeEnd: null,
    })
    expect(entries.map((e) => [e.paidAtYmd, e.gross])).toEqual([
      ['2026-08-08', 840],
      ['2026-08-05', 1000],
    ])
    expect(entries[0]?.offsets).toEqual([{ label: 'Windshield', amount: -425 }])
    expect(entries[1]?.offsets).toEqual([])
  })
})

describe('uncoveredApprovedWeeks (approved hours, no pay report)', () => {
  it('groups uncovered worked days into Sunday weeks, skipping covered and zero days', () => {
    const weeks = uncoveredApprovedWeeks({
      dayHours: [
        { workDate: '2026-07-29', hours: 8 },
        { workDate: '2026-08-10', hours: 8 },
        { workDate: '2026-08-12', hours: 7.5 },
        { workDate: '2026-08-14', hours: 0 },
        { workDate: '2026-08-04', hours: 6 },
      ],
      payStubs: [
        { period_start: '2026-07-26', period_end: '2026-08-01' },
        { period_start: '2026-08-02', period_end: '2026-08-08' },
      ],
    })
    expect(weeks).toEqual([{ weekStart: '2026-08-09', weekEnd: '2026-08-15', hours: 15.5 }])
  })
  it('unreported weeks land in the timeline as red no-report rows dated by week end', () => {
    const rows = buildOffsetPaymentTimeline({
      offsets: [],
      payStubs: [],
      uncoveredWeeks: [{ weekStart: '2026-08-09', weekEnd: '2026-08-15', hours: 15.5 }],
    })
    expect(rows.map((r) => [r.kind, r.dateYmd, r.hours])).toEqual([['unreported', '2026-08-15', 15.5]])
    expect(rows[0]?.label).toBe('No pay report yet · 2026-08-09 – 2026-08-15 · 15.5 h approved')
  })
})

describe('settle-up math', () => {
  it('personSettleUp prices every side of the equation', () => {
    const s = personSettleUp({
      payStubs: [
        stub({ id: 's1', paid_at: null, gross_pay: 620.06 }),
        stub({ id: 's2', gross_pay: 500 }),
        stub({ id: 's3', paid_at: null, gross_pay: 300 }),
      ],
      stubPayments: [{ id: 'p1', pay_stub_id: 's3', amount: 250, paid_at: '2026-08-01T12:00:00Z', memo: null }],
      offsets: [
        offset({ id: 'a', type: 'damage', amount: 1800 }),
        offset({ id: 'b', type: 'employee_credit', amount: 200 }),
        offset({ id: 'c', type: 'backcharge', amount: 100, pay_stub_id: 'applied' }),
      ],
      pricedWeeks: [
        { weekStart: '2026-02-01', weekEnd: '2026-02-07', hours: 40, estAmount: 600 },
        { weekStart: '2026-02-08', weekEnd: '2026-02-14', hours: 10, estAmount: 150 },
      ],
    })
    expect(s.unpaidRemaining).toBe(670.06)
    expect(s.unpaidCount).toBe(2)
    expect(s.unreportedHours).toBe(50)
    expect(s.unreportedEst).toBe(750)
    expect(s.credits).toBe(200)
    expect(s.charges).toBe(1800)
    expect(s.net).toBe(-179.94)
    expect(s.netMissingUnpricedHours).toBe(false)
  })
  it('flags unpriced hours when no wage is known', () => {
    const weeks = priceUncoveredWeeks([{ weekStart: '2026-02-01', weekEnd: '2026-02-07', hours: 40 }], null)
    expect(weeks[0]?.estAmount).toBeNull()
    const s = personSettleUp({ payStubs: [], stubPayments: [], offsets: [], pricedWeeks: weeks })
    expect(s.unreportedEst).toBeNull()
    expect(s.netMissingUnpricedHours).toBe(true)
    expect(s.net).toBe(0)
  })
  it('buildSettleUpBoard sorts action rows most-negative first and settled last', () => {
    const rows = buildSettleUpBoard({
      offsets: [
        offset({ id: 'a', person_name: 'Tristen', type: 'damage', amount: 6617.5 }),
        offset({ id: 'b', person_name: 'Zack', type: 'employee_credit', amount: 335.61 }),
        offset({ id: 'c', person_name: 'Malachi', type: 'backcharge', amount: 50, pay_stub_id: 'applied' }),
      ],
      payStubs: [stub({ id: 's1', person_name: 'Darren', paid_at: null, gross_pay: 49.1 })],
      stubPayments: [],
      dayHours: [{ personName: 'Tristen', workDate: '2026-02-02', hours: 10 }],
      wageForPerson: (name) => (name === 'Tristen' ? 15 : null),
    })
    expect(rows.map((r) => r.personName)).toEqual(['Tristen', 'Darren', 'Zack', 'Malachi'])
    expect(rows[0]?.net).toBe(150 - 6617.5)
    expect(rows[0]?.unreportedEst).toBe(150)
    expect(rows[3]?.net).toBe(0)
  })
})

describe('buildWeeklyHistoryGroups', () => {
  it('groups a report, its payments, and same-week offsets into one block', () => {
    const groups = buildWeeklyHistoryGroups({
      payStubs: [stub({ id: 's1', period_start: '2026-08-02', period_end: '2026-08-08', gross_pay: 300, hours_total: 10.2, paid_at: null })],
      stubPayments: [{ id: 'p1', pay_stub_id: 's1', amount: 127.48, paid_at: '2026-08-07T12:00:00Z', memo: 'cashapp' }],
      offsets: [offset({ id: 'a', occurred_date: '2026-08-07', type: 'employee_credit', amount: 172.52, description: 'weekly' })],
    })
    expect(groups.length).toBe(1)
    const g = groups[0]!
    expect([g.weekStart, g.weekEnd]).toEqual(['2026-08-02', '2026-08-08'])
    expect(g.reportGross).toBe(300)
    expect(g.remaining).toBe(172.52)
    expect(g.payments).toEqual([{ dateYmd: '2026-08-07', amount: 127.48, memo: 'cashapp' }])
    expect(g.offsets[0]?.amount).toBe(172.52)
  })
  it('offset-only weeks stand alone; legacy paid reports show no remaining', () => {
    const groups = buildWeeklyHistoryGroups({
      payStubs: [stub({ id: 's1', period_start: '2026-07-26', period_end: '2026-08-01', gross_pay: 500 })],
      stubPayments: [],
      offsets: [offset({ id: 'a', occurred_date: '2025-10-20', type: 'damage', amount: 1800, description: 'Skid steer' })],
    })
    expect(groups.length).toBe(2)
    expect(groups[0]?.legacyPaid).toBe(true)
    expect(groups[0]?.remaining).toBe(0)
    expect(groups[1]?.reportGross).toBeNull()
    expect(groups[1]?.offsets[0]?.label).toBe('Skid steer')
  })
})
