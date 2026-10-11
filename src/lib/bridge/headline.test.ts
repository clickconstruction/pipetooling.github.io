import { describe, expect, it } from 'vitest'
import { buildHeadline, cashLight, netPositionLight, shortK } from './headline'
import { buildVectorGrid } from './vectorDays'
import type { VectorSession } from './vectors'

const TODAY = '2026-10-10' // a Saturday; the pay week is Oct 4–10
const people = [
  { userId: 'u1', name: 'Abraham', role: 'helpers', archived: false },
  { userId: 'u2', name: 'Tristen', role: 'helpers', archived: false },
]
const wages = [
  { userId: 'u1', fieldWage: 40, officeWage: null, isSalary: false },
  { userId: 'u2', fieldWage: 30, officeWage: null, isSalary: false },
]
const rates = new Map([['j1', 100]])
const s = (userId: string, workDate: string, hours: number, pending = false): VectorSession => ({ userId, workDate, hours, jobId: 'j1', onBid: false, officeJob: false, approved: !pending, pending })

function grids(sessions: VectorSession[]) {
  const common = { zoom: 'weeks' as const, anchorYmd: TODAY, todayYmd: TODAY, people, wages, sessions, ratePerHourByJob: rates }
  return { recorded: buildVectorGrid({ ...common, mode: 'recorded' }), approved: buildVectorGrid({ ...common, mode: 'approved' }) }
}

describe('buildHeadline', () => {
  it('reads the last eight pay weeks, oldest first, the current week last and marked', () => {
    const h = buildHeadline(grids([s('u1', '2026-10-06', 8), s('u1', '2026-08-18', 8)]))
    expect(h.weeks).toHaveLength(8)
    expect(h.weeks[0]?.start).toBe('2026-08-16')
    expect(h.weeks[7]).toMatchObject({ start: '2026-10-04', end: '2026-10-10', current: true, recordedUsd: 480, approvedUsd: 480, recordedHours: 8 })
    expect(h.weeks[0]).toMatchObject({ label: 'Aug 16', recordedUsd: 480, current: false })
    expect(h.weeks[1]?.recordedUsd).toBeNull()
  })

  it('a week with a quarter of its hours pending reads as waiting, and the headline counts them on recorded time', () => {
    const h = buildHeadline(grids([s('u1', '2026-09-29', 6), s('u2', '2026-09-30', 6, true)]))
    const w = h.weeks.find((x) => x.start === '2026-09-27')
    expect(w).toMatchObject({ waiting: true, pendingHours: 6, recordedHours: 12, recordedUsd: 6 * 60 + 6 * 70, approvedUsd: 360 })
  })

  it('verdict: trailing weeks that wait on approval are named as the reason, with the settled range first', () => {
    const sessions = [
      s('u1', '2026-08-18', 10), // Aug 16 week: 10h × (100 − 40) = 600
      s('u1', '2026-08-25', 20), // Aug 23 week: 1,200
      s('u1', '2026-09-29', 4), // Sep 27 week: 240 approved…
      s('u2', '2026-09-30', 20, true), // …and 20h pending → waiting
      s('u2', '2026-10-06', 10, true), // this week, all pending
    ]
    const h = buildHeadline(grids(sessions))
    expect(h.trend).toBe('waiting')
    expect(h.verdict).toBe('Contribution ran $600 to $1.2k a week over the 2 settled weeks. The last 2 weeks read $0 to $240 on approved time only because 30h still wait on approval, not because the field slowed.')
    expect(h.settled).toEqual({ lowUsd: 600, highUsd: 1200, count: 2 })
  })

  it('verdict: a readable window compares the last four weeks with the four before', () => {
    const sessions: VectorSession[] = []
    // Eight closed weeks before this one: Aug 9 … Sep 27, 10h each at $60 contribution/h, the last four at 20h.
    const starts = ['2026-08-09', '2026-08-16', '2026-08-23', '2026-08-30', '2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27']
    starts.forEach((start, i) => sessions.push(s('u1', start.slice(0, 8) + String(Number(start.slice(8)) + 2).padStart(2, '0'), i >= 4 ? 20 : 10)))
    sessions.push(s('u1', '2026-10-06', 5))
    const h = buildHeadline(grids(sessions))
    expect(h.trend).toBe('readable')
    // The window is the last 8 pay weeks: Aug 16 … Oct 4, so 7 closed weeks (3 at $600, 4 at $1.2k) and this week.
    expect(h.verdict).toBe('Contribution ran $600 to $1.2k a week over the last 7 weeks. The last 4 weeks average $1.2k a week. This week is $300 so far.')
  })

  it('verdict: no field hours at all reads thin', () => {
    const h = buildHeadline(grids([]))
    expect(h.trend).toBe('thin')
    expect(h.verdict).toMatch(/No field hours on record/)
  })
})

describe('the lights', () => {
  it('net position: down reads red and names the billing lag', () => {
    const l = netPositionLight({ deltaUsd: -37_400, todayUsd: 114_000, startLabel: 'Aug 15', paperProfitUsd: 54_600, billingLagUsd: 98_100 })
    expect(l.tone).toBe('red')
    expect(l.lead).toBe('down $37.4k since Aug 15')
    expect(l.sentence).toBe('Paper profit over the same weeks is +$54.6k. $98.1k is earned but not invoiced. Bill it to see it.')
  })
  it('net position: up reads green with the line today; unread reads none', () => {
    expect(netPositionLight({ deltaUsd: 5000, todayUsd: 120_000, startLabel: 'Aug 15', paperProfitUsd: null, billingLagUsd: 0 })).toMatchObject({ tone: 'green', lead: 'up $5.0k since Aug 15', sentence: 'The line is $120k today.' })
    expect(netPositionLight(null).tone).toBe('none')
  })
  it('cash: clears the floor on a fresh figure reads green, on a stale typed figure amber, under the floor red', () => {
    const base = { lowestUsd: 15_400, lowestLabel: 'Oct 12', floorUsd: 5000, clearsFloor: true, daysUnderFloor: 0 }
    expect(cashLight({ ...base, typedLabel: null, typedDaysAgo: null })).toMatchObject({ tone: 'green', lead: 'lowest point $15.4k on Oct 12', sentence: 'Above the $5.0k floor every day of the window.' })
    expect(cashLight({ ...base, typedLabel: 'Sep 3', typedDaysAgo: 37 })).toMatchObject({ tone: 'amber', sentence: 'Above the $5.0k floor every day of the window. Cash on hand was typed Sep 3, 37 days ago.' })
    expect(cashLight({ ...base, lowestUsd: -2000, clearsFloor: false, daysUnderFloor: 3, typedLabel: 'Oct 10', typedDaysAgo: 0 })).toMatchObject({ tone: 'red', sentence: '$7.0k under the $5.0k floor, 3 days below it. Cash on hand was typed Oct 10.' })
    expect(cashLight({ ...base, typedLabel: 'Sep 3', typedDaysAgo: 37, synced: true })).toMatchObject({ tone: 'green', sentence: "Above the $5.0k floor every day of the window. Cash on hand is today's bank balance." })
    expect(cashLight(null).tone).toBe('none')
  })
  it('shortK', () => {
    expect(shortK(41_500)).toBe('$41.5k')
    expect(shortK(227_536)).toBe('$228k')
    expect(shortK(-2033)).toBe('−$2.0k')
    expect(shortK(480)).toBe('$480')
  })
})
