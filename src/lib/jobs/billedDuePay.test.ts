import { describe, expect, it } from 'vitest'
import { billedExpectedPayModel, type PaySpeedData } from './billedExpectedPay'
import { billedPayModel } from './billedDuePay'
import { PAY_CALENDAR_DEFAULT, type PayCalendar } from './payCalendar'

/** Paid the 10th of the month after it is received. */
const TENTH: PayCalendar = { ...PAY_CALENDAR_DEFAULT, clause: '§ 5.2' }
const TODAY = '2026-11-12'

/** Larkfield Construction: a median of 41 days, and four payments that landed 0, 6, 6 and 14 days after their due days. */
const DATA: PaySpeedData = {
  company: { medianDays: 12, samples: 200 },
  customers: { lark: { medianDays: 41, samples: 4 } },
  segments: { residential: null, commercial: { medianDays: 20, samples: 60 } },
  customerTypes: { lark: 'commercial', newco: 'commercial' },
  receipts: {
    lark: [
      { billedYmd: '2026-10-06', paidYmd: '2026-11-10', gapDays: 35, jobId: null, jobName: null, address: null },
      { billedYmd: '2026-10-27', paidYmd: '2026-11-16', gapDays: 20, jobId: null, jobName: null, address: null },
      { billedYmd: '2026-09-03', paidYmd: '2026-10-24', gapDays: 51, jobId: null, jobName: null, address: null },
      { billedYmd: '2026-08-20', paidYmd: '2026-09-16', gapDays: 27, jobId: null, jobName: null, address: null },
    ],
  },
  quality: null,
}

const row = (billedYmd: string, customerId = 'lark') => ({ billedAtIso: null, estBillYmd: billedYmd, customerId, payerName: customerId === 'lark' ? 'Larkfield Construction' : 'Newco Builders' })

describe('billedPayModel', () => {
  it('is the pace guess, unchanged, with no calendar', () => {
    const base = billedExpectedPayModel(row('2026-11-03'), DATA, TODAY)
    expect(base?.expectedYmd).toBe('2026-12-14')
    expect(billedPayModel(row('2026-11-03'), DATA, TODAY)).toEqual({ ...base, dueYmd: null, daysPastDue: 0, lateness: null, calendar: null })
    expect(billedPayModel(row('2026-11-03'), DATA, TODAY, null, null, null)?.source).toBe('customer')
    expect(billedPayModel(row('2026-11-03'), null, TODAY)).toBeNull()
  })

  it('keeps due and expected apart: the contract day, and that day plus their usual lateness', () => {
    const m = billedPayModel(row('2026-11-03'), DATA, TODAY, null, null, TENTH)!
    expect(m.source).toBe('terms')
    expect(m.dueYmd).toBe('2026-12-10')
    expect(m.expectedYmd).toBe('2026-12-16')
    expect(m.lateness).toMatchObject({ count: 4, medianDays: 6, onTime: 1 })
    expect(m).toMatchObject({ state: 'upcoming', daysLate: 0, daysPastDue: 0, medianDays: 6, samples: 4, payers: 0 })
    expect(m.label).toBe('Due Dec 10 · lands ~6d after their pay day')
    expect(m.title).toBe(
      'Billed Nov 3. Larkfield Construction pays on a calendar (§ 5.2): A bill in by the last day of the month is paid the 10th of the next month. Due Dec 10. Their last 4 payments landed 0 to 14 days after the due day. Usually about 6. 1 of 4 were on time. Expected about Dec 16.',
    )
  })

  it('reads past due while the money is not yet expected', () => {
    // Billed Oct 27: the pace guess says Dec 7, in 25 days. The contract made it due Nov 10.
    expect(billedExpectedPayModel(row('2026-10-27'), DATA, TODAY)).toMatchObject({ expectedYmd: '2026-12-07', state: 'upcoming' })
    const m = billedPayModel(row('2026-10-27'), DATA, TODAY, null, null, TENTH)!
    expect(m).toMatchObject({ dueYmd: '2026-11-10', daysPastDue: 2, expectedYmd: '2026-11-16', state: 'upcoming', daysLate: 0 })
    expect(m.label).toBe('2d past due · lands ~6d after their pay day')
  })

  it('reads late once the expected day itself has passed', () => {
    const m = billedPayModel(row('2026-09-29'), DATA, TODAY, null, null, TENTH)!
    expect(m).toMatchObject({ dueYmd: '2026-10-10', expectedYmd: '2026-10-16', state: 'late', daysLate: 27, daysPastDue: 33 })
    expect(m.label).toBe('27d past expected · due Oct 10')
  })

  it('takes the due day as the best guess for a payer with a contract and no payment on record', () => {
    // Today's guess for a new commercial payer is the segment's pace.
    expect(billedExpectedPayModel(row('2026-11-03', 'newco'), DATA, TODAY)).toMatchObject({ source: 'segment', expectedYmd: '2026-11-23' })
    const m = billedPayModel(row('2026-11-03', 'newco'), DATA, TODAY, null, null, TENTH)!
    expect(m).toMatchObject({ source: 'terms', dueYmd: '2026-12-10', expectedYmd: '2026-12-10', lateness: null, samples: 0 })
    expect(m.label).toBe('Due Dec 10 · their pay calendar')
    expect(m.title).toContain('No payment on record yet. The due day is the best guess there is.')
    expect(m.title).not.toContain('Expected about')
  })

  it('still reads a calendar when the pay speeds cannot be read', () => {
    expect(billedExpectedPayModel(row('2026-11-03'), null, TODAY)).toBeNull()
    expect(billedPayModel(row('2026-11-03'), null, TODAY, null, null, TENTH)).toMatchObject({ source: 'terms', dueYmd: '2026-12-10', expectedYmd: '2026-12-10' })
  })

  it('lets a date the customer named win the expected day, with the due day beside it', () => {
    const m = billedPayModel(row('2026-10-27'), DATA, TODAY, { promisedYmd: '2026-11-20', markedByName: 'Rosa' }, null, TENTH)!
    expect(m).toMatchObject({ source: 'promised', expectedYmd: '2026-11-20', dueYmd: '2026-11-10', daysPastDue: 2 })
    expect(m.calendar).toEqual(TENTH)
  })

  it('says pay when paid in the reason', () => {
    const m = billedPayModel(row('2026-11-03'), DATA, TODAY, null, null, { ...TENTH, payWhenPaid: true })!
    expect(m.title).toContain('They pay when the owner pays them, so the due day is the earliest.')
  })

  it('falls back to the pace guess for a row with no day to count from', () => {
    const none = { billedAtIso: null, estBillYmd: null, customerId: 'lark', payerName: 'Larkfield Construction' }
    expect(billedPayModel(none, DATA, TODAY, null, null, TENTH)).toBeNull()
    expect(billedPayModel(none, DATA, TODAY, { promisedYmd: '2026-11-20', markedByName: 'Rosa' }, null, TENTH)).toMatchObject({ source: 'promised', dueYmd: null })
  })
})
