import { describe, expect, it } from 'vitest'
import { buildHoursPanel } from './hoursPanel'
import { buildVectorGrid } from './vectorDays'
import type { VectorSession } from './vectors'

const TODAY = '2026-10-10'
const people = [
  { userId: 'u1', name: 'Abraham', role: 'helpers', archived: false },
  { userId: 'u2', name: 'Tristen', role: 'helpers', archived: false },
  { userId: 'u3', name: 'Wendi', role: 'assistant', archived: false },
]
const wages = [
  { userId: 'u1', fieldWage: 40, officeWage: null, isSalary: false },
  { userId: 'u2', fieldWage: 30, officeWage: null, isSalary: false },
  { userId: 'u3', fieldWage: null, officeWage: 28, isSalary: false },
]
const rates = new Map([['j1', 100]])
const field = (userId: string, workDate: string, hours: number, pending = false): VectorSession => ({ userId, workDate, hours, jobId: 'j1', onBid: false, officeJob: false, approved: !pending, pending })
const office = (workDate: string, hours: number): VectorSession => ({ userId: 'u3', workDate, hours, jobId: 'j-office', onBid: false, officeJob: true, approved: true, pending: false })

function grids(sessions: VectorSession[]) {
  const common = { zoom: 'weeks' as const, anchorYmd: TODAY, todayYmd: TODAY, people, wages, sessions, ratePerHourByJob: rates }
  return { recorded: buildVectorGrid({ ...common, mode: 'recorded' }), approved: buildVectorGrid({ ...common, mode: 'approved' }) }
}

describe('buildHoursPanel', () => {
  it('stacks the weeks, walks this week’s hours, and writes the rule line', () => {
    const g = grids([field('u1', '2026-09-22', 10), field('u2', '2026-09-23', 10), office('2026-09-22', 8), field('u1', '2026-10-06', 10), field('u2', '2026-10-07', 12, true), office('2026-10-06', 9)])
    const p = buildHoursPanel({ ...g, officeByWeek: new Map([['2026-09-20', 8], ['2026-10-04', 9]]), todayYmd: TODAY, pendingClosedHours: 12, pendingClosedSessions: 1, officeBidHours7d: 9, jobsWorked: 1, noContractJobs: 0, fieldEarnedPerHour: 100, thisWeekRecordedUsd: 1340, weekLabel: (s) => s })
    const sep = p.weeks.find((w) => w.start === '2026-09-20')!
    expect([sep.approvedField, sep.waitingField, sep.office, sep.total]).toEqual([20, 0, 8, 28])
    const oct = p.weeks.find((w) => w.start === '2026-10-04')!
    expect([oct.approvedField, oct.waitingField, oct.office, oct.current]).toEqual([10, 12, 9, true])
    expect(p.waterfall.map((b) => [b.label, b.hours])).toEqual([
      ['clocked', 31],
      ['waiting, field', -12],
      ['read by the page', 19],
      ['field', 10],
      ['office + bid', 9],
    ])
    expect(p.rule).toBe('The field clocked 22h this week; the page reads 10h. At about $100 earned an hour, the unread 12h is about $1.2k of this week’s +$1.3k. One press on the schedule reads it.')
    expect(p.eightWeeks).toBe('8 weeks: 30h approved in the field, 12h waiting, 17h office. The field ran 20h to 20h a week when every hour was read. 22h clocked in the week still waiting.')
    expect(p.note).toBe('The field did not stop; the reading did. 12h in the window wait on one approve press.')
    expect(p.sources[0]!.risk).toBe('12h of this week’s field sessions are closed and not approved; they are not here')
    expect(p.sources[3]!.tone).toBe('green')
  })
})
