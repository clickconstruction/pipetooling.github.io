import { describe, expect, it } from 'vitest'
import { buildHeadline } from './headline'
import { buildVectorGrid } from './vectorDays'
import type { VectorSession } from './vectors'
import { buildWeekCards } from './weekCard'

const TODAY = '2026-10-10' // a Saturday; the pay week is Oct 4–10
const people = [
  { userId: 'u1', name: 'Abraham', role: 'helpers', archived: false },
  { userId: 'u2', name: 'Tristen', role: 'helpers', archived: false },
]
const wages = [
  { userId: 'u1', fieldWage: 40, officeWage: null, isSalary: false },
  { userId: 'u2', fieldWage: 30, officeWage: null, isSalary: false },
]
const rates = new Map([
  ['j1', 100],
  ['j2', 60],
])
const labels = new Map([
  ['j1', '1047 Magnus Sewer Line'],
  ['j2', '1017 Terrell'],
])
const s = (userId: string, workDate: string, hours: number, jobId = 'j1', pending = false): VectorSession => ({ userId, workDate, hours, jobId, onBid: false, officeJob: false, approved: !pending, pending })

function grids(sessions: VectorSession[]) {
  const common = { zoom: 'weeks' as const, anchorYmd: TODAY, todayYmd: TODAY, people, wages, sessions, ratePerHourByJob: rates, jobLabels: labels }
  return { recorded: buildVectorGrid({ ...common, mode: 'recorded' }), approved: buildVectorGrid({ ...common, mode: 'approved' }) }
}

describe('buildWeekCards', () => {
  it('reads a settled week: the arithmetic, the effort, the jobs and the verdict', () => {
    const g = grids([s('u1', '2026-09-22', 10), s('u2', '2026-09-23', 10, 'j2'), s('u1', '2026-09-15', 8)])
    const headline = buildHeadline(g)
    const cards = buildWeekCards({ headline, ...g, sessionsByWeek: new Map([['2026-09-20', 2]]), dateRange: (a, b) => `${a}–${b}` })
    const wk = cards.find((c) => c.start === '2026-09-20')!
    expect(wk.title).toBe('Pay week 2026-09-20–2026-09-26')
    // j1: 10h × $100 = $1,000 earned, $400 wages; j2: 10h × $60 = $600 earned, $300 wages → $1,600 − $700 = $900
    expect(wk.contribution).toBe('$0.9k contribution')
    expect(wk.earned).toBe('$1.6k')
    expect(wk.wages).toBe('$0.7k')
    expect(wk.effort).toBe('20h on record · 2 sessions · 2 people · $45 an hour')
    expect(wk.jobs.map((j) => [j.label, j.usd])).toEqual([
      ['1047 Magnus Sewer Line', '$1.0k'],
      ['1017 Terrell', '$0.6k'],
    ])
    expect(wk.jobs[1]!.share).toBeCloseTo(0.6, 5)
    expect(wk.foot).toContain('against the 8-week average')
    expect(wk.foot).toContain('the best of the 8')
  })
  it('a waiting week says what it reads and what approved only reads', () => {
    const g = grids([s('u1', '2026-10-06', 10), s('u2', '2026-10-07', 10, 'j1', true)])
    const headline = buildHeadline(g)
    const cards = buildWeekCards({ headline, ...g, dateRange: (a, b) => `${a}–${b}` })
    const wk = cards.find((c) => c.start === '2026-10-04')!
    expect(wk.contribution).toBe('$1.3k contribution so far')
    expect(wk.footTone).toBe('amber')
    expect(wk.foot).toBe('10h waiting. Reads $1.3k on recorded time; approved only $0.6k. Approve on the schedule.')
    expect(wk.effort).toBe('20h on record · 2 people · $65 an hour')
    const empty = cards.find((c) => c.start === '2026-09-20')!
    expect(empty.contribution).toBe('no contribution to read')
    expect(empty.foot).toBe('No field hours on record this week.')
  })
})
