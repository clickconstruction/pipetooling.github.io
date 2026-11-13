import { describe, expect, it } from 'vitest'
import { buildCutoffsComing, type CutoffWork } from './cutoffsComing'
import { indexPayCalendars, PAY_CALENDAR_DEFAULT, type PayCalendarRow } from './payCalendar'

// Today is Thursday 2026-11-12. Larkfield pays the 10th of the month after a bill is in. Sable Ridge wants bills in
// by the 25th and pays the 30th of the next month. Dana Whitfield, a homeowner, has no calendar.
const today = '2026-11-12'
const row = (payerCustomerId: string, over: Partial<PayCalendarRow> = {}): PayCalendarRow => ({ payerCustomerId, jobId: null, off: false, calendar: PAY_CALENDAR_DEFAULT, setByName: null, setAt: null, ...over })
const calendars = indexPayCalendars([row('lark'), row('sable', { calendar: { ...PAY_CALENDAR_DEFAULT, cutoffDay: 25, payDay: 30 } })])
const work = (payerId: string | null, payerName: string | null, jobId: string, dollars: number): CutoffWork => ({ payerId, payerName, jobId, dollars })

const ready = [work('lark', 'Larkfield Construction', 'j1431', 14200), work('sable', 'Sable Ridge Builders', 'j1427', 8900), work('dana', 'Dana Whitfield', 'j1434', 1840)]
const working = [
  work('lark', 'Larkfield Construction', 'j1440', 20000),
  work('lark', 'Larkfield Construction', 'j1441', 18000),
  work('lark', 'Larkfield Construction', 'j1442', 0),
  work('sable', 'Sable Ridge Builders', 'j1450', 21500),
  work('sable', 'Sable Ridge Builders', 'j1451', 0),
]

describe('buildCutoffsComing', () => {
  it('lists each calendar payer with work not yet billed, the nearest cutoff first', () => {
    const lines = buildCutoffsComing({ todayYmd: today, calendars, ready, working })
    expect(lines.map((l) => [l.title, l.detail])).toEqual([
      ['Sable Ridge Builders · in by Nov 25, due Dec 30', '1 bill ready, $8,900. 2 jobs working, $21,500 still to bill.'],
      ['Larkfield Construction · in by Nov 30, due Dec 10', '1 bill ready, $14,200. 3 jobs working, $38,000 still to bill.'],
    ])
    expect(lines[0]).toMatchObject({ payerId: 'sable', cutoffYmd: '2026-11-25', dueYmd: '2026-12-30', nextDueYmd: '2027-01-30', daysLeft: 13, soon: false, calendarShort: 'In by the 25th, paid the 30th', ready: { count: 1, dollars: 8900 }, working: { count: 2, dollars: 21500 } })
  })

  it('leaves out a payer with no calendar, and one with nothing ready or working', () => {
    const lines = buildCutoffsComing({ todayYmd: today, calendars, ready: [work('dana', 'Dana Whitfield', 'j1434', 1840)], working: [] })
    expect(lines).toEqual([])
    expect(buildCutoffsComing({ todayYmd: today, calendars: null, ready, working })).toEqual([])
  })

  it('says only what there is: ready alone, working alone, working with nothing priced', () => {
    expect(buildCutoffsComing({ todayYmd: today, calendars, ready: [ready[0]!], working: [] })[0]!.detail).toBe('1 bill ready, $14,200.')
    expect(buildCutoffsComing({ todayYmd: today, calendars, ready: [], working: [working[0]!, working[1]!] })[0]!.detail).toBe('2 jobs working, $38,000 still to bill.')
    expect(buildCutoffsComing({ todayYmd: today, calendars, ready: [], working: [working[2]!] })[0]!.detail).toBe('1 job working.')
    // A ready bill with no price yet says its count and no dollars.
    expect(buildCutoffsComing({ todayYmd: today, calendars, ready: [work('lark', 'Larkfield Construction', 'j1460', 0)], working: [] })[0]!.detail).toBe('1 bill ready.')
  })

  it('asks in the last week, and moves to next month the day after the cutoff', () => {
    expect(buildCutoffsComing({ todayYmd: '2026-11-20', calendars, ready, working: [] }).map((l) => [l.payerId, l.soon, l.daysLeft])).toEqual([
      ['sable', true, 5],
      ['lark', false, 10],
    ])
    expect(buildCutoffsComing({ todayYmd: '2026-11-26', calendars, ready, working: [] }).map((l) => l.title)).toEqual(['Larkfield Construction · in by Nov 30, due Dec 10', 'Sable Ridge Builders · in by Dec 25, due Jan 30'])
  })

  it("gives a job on its own calendar a line of its own, and none to a job that switches the payer's off", () => {
    const own = indexPayCalendars([row('lark'), row('lark', { jobId: 'j1441', calendar: { ...PAY_CALENDAR_DEFAULT, cutoffDay: 20 } }), row('lark', { jobId: 'j1442', off: true, calendar: null })])
    const lines = buildCutoffsComing({ todayYmd: today, calendars: own, ready: [], working: working.slice(0, 3) })
    expect(lines.map((l) => [l.title, l.detail])).toEqual([
      ['Larkfield Construction · in by Nov 20, due Dec 10', '1 job working, $18,000 still to bill.'],
      ['Larkfield Construction · in by Nov 30, due Dec 10', '1 job working, $20,000 still to bill.'],
    ])
  })

  it('drops work with no payer and reads an unnamed payer as a customer', () => {
    const lines = buildCutoffsComing({ todayYmd: today, calendars, ready: [work(null, null, 'jx', 500), work('lark', null, 'jy', 700)], working: [] })
    expect(lines.map((l) => l.title)).toEqual(['A customer · in by Nov 30, due Dec 10'])
  })
})
