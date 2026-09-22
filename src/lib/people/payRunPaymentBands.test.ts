import { describe, expect, it } from 'vitest'
import { buildPayRunPaymentBands, PAY_RUN_PAYMENT_MODES, payRunPaymentBandLine, type PayRunBandDates } from './payRunPaymentBands'
import { sortPayRunPayments, type PayRunPaymentRow } from './payRunPayments'

const row = (id: string, paidYmd: string, person: string, amount: number): PayRunPaymentRow => ({
  id,
  paidAt: `${paidYmd}T17:00:00+00:00`,
  amount,
  memo: null,
  sourceKind: null,
  sourceId: null,
  createdBy: null,
  createdAt: null,
  stub: { id: `s-${id}`, personName: person, periodStart: '2026-09-06', periodEnd: '2026-09-12' },
})

// The mock-up's eight rows: Sep 16 (Wed) ×3, Sep 11 (Fri), Sep 5 (Sat) ×4 — 2026-09-13 and 09-06 are Sundays.
const ROWS = [
  row('a', '2026-09-16', 'Paige', 291.55),
  row('b', '2026-09-16', 'Taunya', 100),
  row('c', '2026-09-16', 'Malachi', 100),
  row('d', '2026-09-11', 'Paige', 500),
  row('e', '2026-09-05', 'Paige', 500),
  row('f', '2026-09-05', 'Isiah', 385.92),
  row('g', '2026-09-05', 'Grace', 249.95),
  row('h', '2026-09-05', 'Wendi', 518.6),
]

const ymdAdd = (ymd: string, d: number) => {
  const [y, m, dd] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, dd! + d)).toISOString().slice(0, 10)
}
// Sunday-start weeks, computed in UTC for the test (the app passes its Chicago reader).
const DATES: PayRunBandDates = {
  dayOf: (r) => r.paidAt.slice(0, 10),
  weekStartOf: (ymd) => ymdAdd(ymd, -new Date(`${ymd}T00:00:00Z`).getUTCDay()),
  addDays: ymdAdd,
}
const money = (n: number) => `$${n.toFixed(2)}`

describe('buildPayRunPaymentBands', () => {
  it('names the three modes and makes no bands for flat', () => {
    expect(PAY_RUN_PAYMENT_MODES.map((m) => m.key)).toEqual(['flat', 'week', 'person'])
    expect(buildPayRunPaymentBands(ROWS, 'flat', { key: 'paid', dir: 'desc' }, DATES)).toEqual([])
  })

  it('bands by the Sunday-start week the money went out, newest first, with count, sum and people', () => {
    const bands = buildPayRunPaymentBands(sortPayRunPayments(ROWS, 'paid', 'desc'), 'week', { key: 'paid', dir: 'desc' }, DATES)
    expect(bands.map((b) => [b.periodStart, b.periodEnd, b.count, b.sumUsd, b.people])).toEqual([
      ['2026-09-13', '2026-09-19', 3, 491.55, 3],
      ['2026-09-06', '2026-09-12', 1, 500, 1],
      ['2026-08-30', '2026-09-05', 4, 1654.47, 4],
    ])
    expect(bands[0]!.rows.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(payRunPaymentBandLine(bands[0]!, 'week', money)).toBe('3 payments · $491.55 · 3 people')
    expect(payRunPaymentBandLine(bands[1]!, 'week', money)).toBe('1 payment · $500.00 · 1 person')
  })

  it('follows Paid on ascending with the oldest week first, and keeps any other sort inside the band', () => {
    const asc = buildPayRunPaymentBands(sortPayRunPayments(ROWS, 'paid', 'asc'), 'week', { key: 'paid', dir: 'asc' }, DATES)
    expect(asc.map((b) => b.periodStart)).toEqual(['2026-08-30', '2026-09-06', '2026-09-13'])
    const byAmount = buildPayRunPaymentBands(sortPayRunPayments(ROWS, 'amount', 'desc'), 'week', { key: 'amount', dir: 'desc' }, DATES)
    expect(byAmount.map((b) => b.periodStart)).toEqual(['2026-09-13', '2026-09-06', '2026-08-30'])
    expect(byAmount[2]!.rows.map((r) => r.id)).toEqual(['h', 'e', 'f', 'g'])
  })

  it('bands by person A → Z with the weeks they were paid in, and flips only with the Person sort', () => {
    const bands = buildPayRunPaymentBands(sortPayRunPayments(ROWS, 'paid', 'desc'), 'person', { key: 'paid', dir: 'desc' }, DATES)
    expect(bands.map((b) => [b.personName, b.count, b.sumUsd, b.weeks])).toEqual([
      ['Grace', 1, 249.95, 1],
      ['Isiah', 1, 385.92, 1],
      ['Malachi', 1, 100, 1],
      ['Paige', 3, 1291.55, 3],
      ['Taunya', 1, 100, 1],
      ['Wendi', 1, 518.6, 1],
    ])
    expect(payRunPaymentBandLine(bands[3]!, 'person', money)).toBe('3 payments · $1291.55 · 3 weeks')
    expect(bands[3]!.rows.map((r) => r.id)).toEqual(['a', 'd', 'e'])
    const desc = buildPayRunPaymentBands(sortPayRunPayments(ROWS, 'person', 'desc'), 'person', { key: 'person', dir: 'desc' }, DATES)
    expect(desc.map((b) => b.personName)).toEqual(['Wendi', 'Taunya', 'Paige', 'Malachi', 'Isiah', 'Grace'])
  })

  it('treats a name the same whatever its case or spacing, and shows the rows\' own spelling', () => {
    const bands = buildPayRunPaymentBands([row('x', '2026-09-16', 'paige ', 1), row('y', '2026-09-16', 'Paige', 2)], 'person', { key: 'paid', dir: 'desc' }, DATES)
    expect(bands.length).toBe(1)
    expect(bands[0]!.personName).toBe('paige')
    expect(bands[0]!.sumUsd).toBe(3)
  })
})
