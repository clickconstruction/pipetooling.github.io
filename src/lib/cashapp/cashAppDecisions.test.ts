import { describe, expect, it } from 'vitest'
import { advanceOffsetInsert, cashAppPaymentMemo, clampRecordAmount, suggestReportForSend, type OpenReportForSend } from './cashAppDecisions'

const r = (id: string, person: string, start: string, end: string, remaining: number): OpenReportForSend => ({ id, personName: person, periodStart: start, periodEnd: end, remaining })
const REPORTS = [
  r('w33', 'Darren', '2026-08-09', '2026-08-15', 0),
  r('w34', 'Darren', '2026-08-16', '2026-08-22', 500),
  r('w35', 'Darren', '2026-08-23', '2026-08-29', 300),
  r('w36', 'Darren', '2026-08-30', '2026-09-05', 450),
  r('p1', 'Paige', '2026-08-23', '2026-08-29', 954.25),
]

describe('cashAppPaymentMemo', () => {
  it('carries the id and the note', () => {
    expect(cashAppPaymentMemo('#D-3V3MVPKVP', 'Week')).toBe('Cash App #D-3V3MVPKVP "Week"')
    expect(cashAppPaymentMemo('#D-3V3MVPKVP', '  ')).toBe('Cash App #D-3V3MVPKVP')
  })
})

describe('suggestReportForSend', () => {
  it('prefers the latest open report that ended on or before the send, and clamps the amount', () => {
    const out = suggestReportForSend({ personName: 'Darren', sendDate: '2026-08-31', amountSent: 500, reports: REPORTS })
    expect(out.options.map((o) => o.id)).toEqual(['w34', 'w35', 'w36'])
    expect(out.suggestedId).toBe('w35')
    expect(out.suggestedAmount).toBe(300)
  })

  it('falls back to the earliest open report when nothing has ended yet (paying ahead)', () => {
    const out = suggestReportForSend({ personName: 'Darren', sendDate: '2026-08-10', amountSent: 200, reports: REPORTS })
    expect(out.suggestedId).toBe('w34')
    expect(out.suggestedAmount).toBe(200)
  })

  it('returns nothing to pick for a person with no open report', () => {
    expect(suggestReportForSend({ personName: 'Kyle', sendDate: '2026-09-01', amountSent: 300, reports: REPORTS })).toEqual({ options: [], suggestedId: null, suggestedAmount: 0 })
  })
})

describe('clampRecordAmount', () => {
  it('parses money text, clamps to remaining, rejects junk', () => {
    expect(clampRecordAmount('$1,200.00', 954.25)).toBe(954.25)
    expect(clampRecordAmount('300', 954.25)).toBe(300)
    expect(clampRecordAmount('0', 954.25)).toBeNull()
    expect(clampRecordAmount('abc', 954.25)).toBeNull()
  })
})

describe('advanceOffsetInsert', () => {
  it('builds a pending advance offset dated the send day with the memo as description', () => {
    expect(advanceOffsetInsert({ personName: 'Malachi', txId: '#D-8P98VO594', note: 'Advance', amountSent: 500, occurredDate: '2026-09-10' })).toEqual({
      person_name: 'Malachi',
      type: 'advance',
      amount: 500,
      description: 'Cash App #D-8P98VO594 "Advance"',
      occurred_date: '2026-09-10',
    })
  })
})
