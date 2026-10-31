import { describe, expect, it } from 'vitest'
import {
  draftPayrollBars,
  draftPayrollRowBar,
  draftPayrollRowStatus,
  paidDayWords,
  pendingChipWords,
  pendingDotTitle,
  pendingDotWords,
  rowHasPayDue,
  wholeShares,
  type DraftPayrollRowBarInput,
} from './draftPayrollBars'

const base: DraftPayrollRowBarInput = {
  person: 'Hal Sample',
  hours: 38.25,
  estGross: 1071,
  report: null,
  isSalary: false,
  reviewCount: 0,
  pendingSessions: 0,
}

describe('draftPayrollRowStatus', () => {
  it('reads the same six words the Status column read', () => {
    expect(draftPayrollRowStatus({ estGross: 0, report: null, reviewCount: 0 })).toBe('No hours')
    expect(draftPayrollRowStatus({ estGross: 500, report: null, reviewCount: 0 })).toBe('Ready')
    expect(draftPayrollRowStatus({ estGross: 500, report: null, reviewCount: 2 })).toBe('Review')
    expect(draftPayrollRowStatus({ estGross: 500, report: { gross: 500, net: 450, paidSum: 0, paidYmd: null }, reviewCount: 0 })).toBe('Report only')
    expect(draftPayrollRowStatus({ estGross: 500, report: { gross: 500, net: 450, paidSum: 100, paidYmd: null }, reviewCount: 0 })).toBe('Partial')
    expect(draftPayrollRowStatus({ estGross: 500, report: { gross: 500, net: 450, paidSum: 450, paidYmd: null }, reviewCount: 0 })).toBe('Paid')
  })
})

describe('draftPayrollRowBar', () => {
  it('an estimate with no report is one hatched part, the figure wears est.', () => {
    const row = draftPayrollRowBar(base)
    expect(row.cashDue).toBe(1071)
    expect(row.estimated).toBe(true)
    expect(row.status).toBe('Ready')
    expect(row.parts).toEqual([{ kind: 'estimate', amount: 1071, fraction: 1, label: 'no report yet', title: '$1,071.00 estimated from the hours. No report yet.' }])
    expect(row.words).toBe('$1,071.00 estimated from the hours. No report yet.')
  })

  it('a paid report is one green part that names the day it was paid', () => {
    const row = draftPayrollRowBar({ ...base, report: { gross: 1071, net: 1071, paidSum: 1071, paidYmd: '2026-10-23' } })
    expect(row.estimated).toBe(false)
    expect(row.status).toBe('Paid')
    expect(row.parts.map((p) => [p.kind, p.amount, p.label])).toEqual([['paid', 1071, 'paid Fri']])
    expect(row.parts[0]?.fraction).toBe(1)
  })

  it('a part-paid report splits into paid and still owed, with the deductions withheld', () => {
    const row = draftPayrollRowBar({ ...base, person: 'Paco Sample', estGross: 1300, report: { gross: 1245, net: 1245, paidSum: 373, paidYmd: '2026-10-24' } })
    expect(row.cashDue).toBe(1245)
    expect(row.status).toBe('Partial')
    expect(row.parts.map((p) => [p.kind, p.amount, p.label])).toEqual([
      ['paid', 373, '$373.00'],
      ['owed', 872, 'owed $872.00'],
    ])
    expect(row.parts[0]?.fraction).toBeCloseTo(373 / 1245, 5)
    expect(row.parts[1]?.fraction).toBeCloseTo(872 / 1245, 5)

    const withheld = draftPayrollRowBar({ ...base, report: { gross: 1245, net: 1045, paidSum: 0, paidYmd: null } })
    expect(withheld.parts.map((p) => [p.kind, p.amount, p.label])).toEqual([
      ['owed', 1045, 'report due'],
      ['withheld', 200, '$200.00'],
    ])
    expect(withheld.scale).toBe(1245)
  })

  it('a report whose additional lines lift its net past its gross draws to the larger figure', () => {
    const row = draftPayrollRowBar({ ...base, report: { gross: 1000, net: 1100, paidSum: 0, paidYmd: null } })
    expect(row.cashDue).toBe(1000)
    expect(row.scale).toBe(1100)
    expect(row.parts.map((p) => [p.kind, p.amount, p.fraction])).toEqual([['owed', 1100, 1]])
  })

  it('no hours is an empty bar with its words', () => {
    const row = draftPayrollRowBar({ ...base, hours: 0, estGross: 0 })
    expect(row.status).toBe('No hours')
    expect(row.parts).toEqual([])
    expect(row.words).toBe('No hours in this period')
    expect(row.estimated).toBe(false)
  })

  it('salaried hours wear the chip; a salaried person with no hours does not', () => {
    expect(draftPayrollRowBar({ ...base, isSalary: true, hours: 40 }).salaryFlat).toBe(true)
    expect(draftPayrollRowBar({ ...base, isSalary: true, hours: 0, estGross: 0 }).salaryFlat).toBe(false)
    expect(draftPayrollRowBar({ ...base, isSalary: false, hours: 40 }).salaryFlat).toBe(false)
  })

  it('pending sessions land on the row with their words', () => {
    const row = draftPayrollRowBar({ ...base, pendingSessions: 2 })
    expect(row.pendingSessions).toBe(2)
    expect(row.words).toContain('2 clock sessions of theirs in this period still need approval')
    expect(pendingDotWords(2)).toBe('2 waiting')
    expect(pendingDotTitle(1)).toContain('1 clock session of theirs in this period still needs approval')
    expect(pendingChipWords(3)).toBe('3 sessions await approval ›')
    expect(pendingChipWords(1)).toBe('1 session awaits approval ›')
  })
})

describe('draftPayrollBars', () => {
  it('sums the rows into the period bar in part order, with the caption Total printed', () => {
    const bars = draftPayrollBars(
      [
        { ...base, person: 'Hal', report: { gross: 1071, net: 1071, paidSum: 1071, paidYmd: '2026-10-23' } },
        { ...base, person: 'Paco', report: { gross: 1245, net: 1245, paidSum: 373, paidYmd: '2026-10-24' }, pendingSessions: 2 },
        { ...base, person: 'Rosa', estGross: 1120, hours: 40, isSalary: true },
        { ...base, person: 'Sid', report: { gross: 1062, net: 962, paidSum: 0, paidYmd: null } },
        // On the roster with no hours this week: not counted as having pay due.
        { ...base, person: 'Eli', hours: 0, estGross: 0 },
      ],
    )
    expect(bars.period.total).toBe(1071 + 1245 + 1120 + 1062)
    expect(bars.period.caption).toBe('This period · $4,498.00 · 1 of 4 paid')
    expect([bars.period.paidCount, bars.period.dueCount, bars.period.rosterCount]).toEqual([1, 4, 5])
    expect(bars.period.captionTitle).toBe('4 of the 5 on the roster have pay due this period (a report, hours or an estimate); 1 of them is paid in full.')
    expect(bars.period.parts.map((p) => [p.kind, p.amount, p.label])).toEqual([
      ['paid', 1071 + 373, 'paid $1,444.00 (32%)'],
      ['owed', 872 + 962, 'owed $1,834.00 (41%)'],
      ['withheld', 100, 'withheld $100.00 (2%)'],
      ['estimate', 1120, 'no report $1,120.00 (25%)'],
    ])
    expect(bars.period.parts.map((p) => p.title)).toEqual([
      '$1,444.00 paid · 32% of the period',
      '$1,834.00 owed on a report · 41% of the period',
      '$100.00 withheld · 2% of the period',
      '$1,120.00 no report yet · 25% of the period',
    ])
    const fractions = bars.period.parts.reduce((s, p) => s + p.fraction, 0)
    expect(fractions).toBeCloseTo(1, 5)
    expect(bars.rows.map((r) => r.person)).toEqual(['Hal', 'Paco', 'Rosa', 'Sid', 'Eli'])
  })

  it('an empty roster is an empty bar and a zero caption', () => {
    const bars = draftPayrollBars([])
    expect(bars.period.parts).toEqual([])
    expect(bars.period.caption).toBe('This period · $0.00 · 0 of 0 paid')
    expect(rowHasPayDue({ report: null, hours: 0, estGross: 0 })).toBe(false)
    expect(rowHasPayDue({ report: { gross: 1, net: 1, paidSum: 0, paidYmd: null }, hours: 0, estGross: 0 })).toBe(true)
    expect(rowHasPayDue({ report: null, hours: 2, estGross: 0 })).toBe(true)
  })
})

describe('wholeShares', () => {
  it('rounds to whole shares that add to 100', () => {
    expect(wholeShares([0.6879, 0.3121])).toEqual([69, 31])
    expect(wholeShares([1 / 3, 1 / 3, 1 / 3])).toEqual([34, 33, 33])
    expect(wholeShares([0.5, 0.25, 0.25])).toEqual([50, 25, 25])
    expect(wholeShares([1])).toEqual([100])
    expect(wholeShares([])).toEqual([])
  })
})

describe('paidDayWords', () => {
  it('names the weekday of a day, never an instant', () => {
    expect(paidDayWords('2026-10-23')).toBe('Fri')
    expect(paidDayWords('2026-10-25')).toBe('Sun')
    expect(paidDayWords(null)).toBe('')
    expect(paidDayWords('2026-10-23T15:00:00Z')).toBe('')
  })
})
