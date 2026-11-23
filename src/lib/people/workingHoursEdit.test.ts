import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { sentenceParts } from '../valuesInPlace'
import type { Segment, WeekDays } from './weekAvailability'
import { FIRST_WORKING_DAYS, FIRST_WORKING_RANGE, workingHoursFieldPlan, workingSundayWords, type WorkingHoursFacts, type WorkingHoursOpen } from './workingHoursEdit'

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

describe('workingSundayWords', () => {
  it('prints the Sunday hours hold from', () => {
    expect(workingSundayWords('2026-11-22')).toBe('Sun Nov 22')
    expect(workingSundayWords('2026-11-29')).toBe('Sun Nov 29')
  })
})
