import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { sentenceParts } from '../valuesInPlace'
import type { Segment, WeekDays } from './weekAvailability'
import { FIRST_WORKING_DAYS, FIRST_WORKING_RANGE, workingHoursFieldPlan, workingHoursTakeOffPlan, workingSundayWords, type WorkingHoursFacts, type WorkingHoursOpen } from './workingHoursEdit'

const weekdays = (...segs: Segment[]): WeekDays => [[], segs, segs, segs, segs, segs, []]
const SIX_TO_NOON = weekdays([360, 720])
const plain = (s: string) => sentenceParts(s).map((p) => (typeof p === 'string' ? p : p.text)).join('')
// Wednesday Nov 25, 2026: this week's Sunday is Nov 22, next week's Nov 29.
const salaried: WorkingHoursFacts = { current: SIX_TO_NOON, isSalary: true, paidWeek: [0, 6, 6, 6, 6, 6, 0], firstName: 'Wes', todayYmd: '2026-11-25', lastReportEndYmd: null }
const hourly: WorkingHoursFacts = { ...salaried, isSalary: false, paidWeek: null }
const open = (over: Partial<WorkingHoursOpen>): WorkingHoursOpen => ({ dows: [1, 2, 3, 4, 5], segs: [[360, 720]], start: 'this', reason: '', ...over })

describe('workingHoursFieldPlan', () => {
  it('has nothing to keep until something changes', () => {
    const plan = workingHoursFieldPlan(salaried, open({}))
    expect(plan.keep).toEqual({ ok: false, why: null })
    expect(plan.pay).toEqual({ moves: false, words: 'Each day keeps its length, so pay does not move.' })
  })

  it('moves a whole line by an hour with no pay change, from next week, with no reason', () => {
    const plan = workingHoursFieldPlan(salaried, open({ segs: [[420, 780]], start: 'next' }))
    expect(plan.keep).toEqual({ ok: true })
    expect(plan.week).toEqual(weekdays([420, 780]))
    expect([plan.startLocked, plan.needsReason, plan.effectiveFrom]).toEqual([false, false, '2026-11-29'])
    expect(plan.pay?.moves).toBe(false)
    expect(plain(plan.sentence)).toBe('Mon to Fri would be 7:00 AM to 1:00 PM, 6 h a day. The week would be 30 h.')
  })

  it('holds a change to a salaried day’s length to this week, and waits for a reason', () => {
    const friday = open({ dows: [5], segs: [[360, 615]], start: 'next' })
    const waiting = workingHoursFieldPlan(salaried, friday)
    expect(waiting.keep).toEqual({ ok: false, why: 'Say why first. The reason goes on the pay log.' })
    expect([waiting.startLocked, waiting.needsReason, waiting.effectiveFrom]).toEqual([true, true, '2026-11-22'])
    expect(plain(waiting.pay!.words)).toBe('Wes is on a set week. Pay follows the hours, so the set week becomes 28.25 h.')
    expect(waiting.week[5]).toEqual([[360, 615]])
    expect(workingHoursFieldPlan(salaried, { ...friday, reason: ' A class on Fridays ' }).keep).toEqual({ ok: true })
  })

  it('says how many weeks with no pay report a pay change prices again', () => {
    const facts = { ...salaried, lastReportEndYmd: '2026-11-07' }
    expect(plain(workingHoursFieldPlan(facts, open({ dows: [5], segs: [[360, 615]] })).pay!.words)).toBe('Wes is on a set week. Pay follows the hours, so the set week becomes 28.25 h. 2 earlier weeks have no pay report, and will be priced at the new hours.')
    expect(plain(workingHoursFieldPlan({ ...salaried, lastReportEndYmd: '2026-11-14' }, open({ dows: [5], segs: [[360, 615]] })).pay!.words)).toContain('One earlier week has no pay report')
  })

  it('leaves an hourly person with no pay side at all', () => {
    const plan = workingHoursFieldPlan(hourly, open({ dows: [3], segs: [[360, 600]], start: 'next' }))
    expect(plan.pay).toBeNull()
    expect(plan.keep).toEqual({ ok: true })
    expect([plan.startLocked, plan.needsReason, plan.effectiveFrom]).toEqual([false, false, '2026-11-29'])
  })

  it('names the one thing to fix', () => {
    expect(workingHoursFieldPlan(hourly, open({ segs: [[720, 360]] })).keep).toEqual({ ok: false, why: 'Monday ends before it starts.' })
    expect(workingHoursFieldPlan(hourly, open({ dows: [1], segs: [[360, 720], [720, 900]] })).keep).toEqual({ ok: false, why: 'Monday needs a break between its two ranges.' })
    expect(workingHoursFieldPlan({ ...hourly, current: [[], [[360, 720]], [], [], [], [], []] }, open({ dows: [1], segs: [] })).keep).toEqual({ ok: false, why: 'Give at least one day its hours.' })
  })

  it('opens the first time from a week with no hours, and any week is a change', () => {
    const first = workingHoursFieldPlan({ ...hourly, current: null }, open({ dows: FIRST_WORKING_DAYS, segs: [FIRST_WORKING_RANGE] }))
    expect(first.keep).toEqual({ ok: true })
    expect(first.week).toEqual(weekdays([420, 900]))
    expect(plain(first.sentence)).toBe('Mon to Fri would be 7:00 AM to 3:00 PM, 8 h a day. The week would be 40 h.')
  })

  it('takes a day off, and makes a half day, as a change like any other', () => {
    expect(workingHoursFieldPlan(hourly, open({ dows: [5], segs: [] })).week[5]).toEqual([])
    const half = workingHoursFieldPlan({ ...salaried, current: weekdays([420, 900]), paidWeek: [0, 8, 8, 8, 8, 8, 0] }, open({ dows: [3], segs: [[420, 660]], reason: 'Half days on Wednesdays' }))
    expect(half.keep).toEqual({ ok: true })
    expect(half.week[3]).toEqual([[420, 660]])
    expect(half.week[2]).toEqual([[420, 900]])
  })

  it('says every sentence in plain words', () => {
    for (const s of ['Say why first. The reason goes on the pay log.', 'Give at least one day its hours.', 'Each day keeps its length, so pay does not move.', plain(workingHoursFieldPlan({ ...salaried, lastReportEndYmd: '2026-11-07' }, open({ dows: [5], segs: [[360, 615]] })).pay!.words)]) expect(plainWordsFailures(s)).toEqual([])
  })
})

describe('workingHoursTakeOffPlan', () => {
  it('puts a salaried person back on the standard week, from this week, and asks why', () => {
    const off = workingHoursTakeOffPlan(salaried, 'Wes Calloway')
    expect([off.movesPay, off.needsReason, off.effectiveFrom]).toEqual([true, true, '2026-11-22'])
    expect(off.message).toBe(
      'Take working hours off Wes Calloway? From this week nothing holds them to a start and an end. Their set week on pay is 6 h Mon to Fri today. It goes back to the standard week, 8 h Mon to Fri. Say why. The reason goes on the pay log. What the hours were is kept under Earlier hours.',
    )
    expect(off.done).toBe('Working hours taken off. Pay is back on the standard week.')
  })

  it('says how many weeks with no pay report the standard week prices again', () => {
    expect(workingHoursTakeOffPlan({ ...salaried, lastReportEndYmd: '2026-11-07' }, 'Wes Calloway').message).toContain('2 earlier weeks have no pay report, and will be priced at the standard week.')
    expect(workingHoursTakeOffPlan({ ...salaried, lastReportEndYmd: '2026-11-14' }, 'Wes Calloway').message).toContain('One earlier week has no pay report, and will be priced at the standard week.')
  })

  it('moves no pay for a salaried person already on the standard week, and asks for no reason', () => {
    const off = workingHoursTakeOffPlan({ ...salaried, current: weekdays([420, 900]), paidWeek: [0, 8, 8, 8, 8, 8, 0] }, 'Wes Calloway')
    expect([off.movesPay, off.needsReason]).toEqual([false, false])
    expect(off.message).toBe('Take working hours off Wes Calloway? From this week nothing holds them to a start and an end. Their pay stays on the standard week, 8 h Mon to Fri. What the hours were is kept under Earlier hours.')
    expect(off.done).toBe('Working hours taken off')
  })

  it('has no pay side for an hourly person', () => {
    const off = workingHoursTakeOffPlan(hourly, 'Wes Calloway')
    expect([off.movesPay, off.needsReason]).toEqual([false, false])
    expect(off.message).toBe('Take working hours off Wes Calloway? From this week nothing holds them to a start and an end. What the hours were is kept under Earlier hours.')
  })

  it('reads a week with a short day as a week of its own', () => {
    const off = workingHoursTakeOffPlan({ ...salaried, paidWeek: [0, 8, 8, 8, 8, 4.25, 0] }, 'Wes Calloway')
    expect(off.movesPay).toBe(true)
    expect(off.message).toContain('Their set week on pay is 8 h Mon to Thu, 4.25 h Fri today.')
  })

  it('says every sentence in plain words', () => {
    for (const facts of [salaried, { ...salaried, lastReportEndYmd: '2026-11-07' }, { ...salaried, paidWeek: [0, 8, 8, 8, 8, 8, 0] }, hourly]) {
      const off = workingHoursTakeOffPlan(facts, 'Wes Calloway')
      expect(plainWordsFailures(off.message)).toEqual([])
      expect(plainWordsFailures(off.done)).toEqual([])
    }
  })
})

describe('workingSundayWords', () => {
  it('prints the Sunday hours hold from', () => {
    expect(workingSundayWords('2026-11-22')).toBe('Sun Nov 22')
    expect(workingSundayWords('2026-11-29')).toBe('Sun Nov 29')
  })
})
