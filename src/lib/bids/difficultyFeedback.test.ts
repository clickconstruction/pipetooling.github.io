import { describe, expect, it } from 'vitest'
import { buildDifficultyFeedback, difficultyFeedbackJobWords, difficultyPricedHours, type FeedbackBid, type FeedbackJob } from './difficultyFeedback'

const RATED = '2026-11-14T20:00:00Z'
const bid = (bidId: string, over: Partial<FeedbackBid> = {}): FeedbackBid => ({ bidId, outcome: null, pricedOrCreatedAt: '2026-11-20T15:00:00Z', sent: true, pricedDifficultyUsd: 0, ...over })
const job = (jobId: string, clockedHours: number, pricedHours: number, done = true): FeedbackJob => ({ jobId, label: `${jobId} Riverside`, done, clockedHours, pricedHours })

describe('buildDifficultyFeedback', () => {
  it('counts only the bids priced since the GC was first rated', () => {
    const f = buildDifficultyFeedback({ firstRatedAt: RATED, bids: [bid('a', { pricedOrCreatedAt: '2026-10-01T15:00:00Z', outcome: 'won' }), bid('b', { outcome: 'won', pricedDifficultyUsd: 4200 }), bid('c', { outcome: 'lost', pricedDifficultyUsd: 2220 }), bid('d'), bid('e', { sent: false })], jobs: [] })
    expect([f.bids, f.won, f.lost, f.waiting, f.unsent]).toEqual([4, 1, 1, 1, 1])
    expect(f.pricedIn).toEqual({ bids: 2, usd: 6420 })
    expect(f.lines).toEqual(['4 bids to them since they were rated on 2026-11-14: 1 won, 1 lost, 1 waiting on an answer, 1 not sent yet.', 'Difficulty priced in: $6,420 on 2 bids.'])
    expect(f.nudge).toBeNull()
  })

  it('says so when nothing has been priced since', () => {
    const f = buildDifficultyFeedback({ firstRatedAt: RATED, bids: [bid('a', { pricedOrCreatedAt: '2026-10-01T15:00:00Z' })], jobs: [] })
    expect(f.lines).toEqual(['No bid to them has been priced since they were rated on 2026-11-14.'])
  })

  it('a started bid counts as won, and one with no difficulty priced in says so', () => {
    const f = buildDifficultyFeedback({ firstRatedAt: RATED, bids: [bid('a', { outcome: 'started_or_complete' })], jobs: null })
    expect(f.won).toBe(1)
    expect(f.lines).toEqual(['1 bid to them since they were rated on 2026-11-14: 1 won.', 'No difficulty cost is priced into them yet.'])
  })

  it('judges a done job, and an open one only once it is past its hours; the nudge names the overrun', () => {
    const f = buildDifficultyFeedback({ firstRatedAt: RATED, bids: [bid('a', { outcome: 'won', pricedDifficultyUsd: 3840 })], jobs: [job('1042', 544, 528), job('1043', 400, 420), job('1044', 610, 562, false), job('1045', 100, 500, false), job('1046', 50, 0)] })
    expect(f.jobs.map((j) => j.jobId)).toEqual(['1044', '1042', '1043'])
    expect([f.jobsPast, f.hoursPast, f.jobsOpen]).toEqual([2, 64, 1])
    expect(f.lines.slice(2)).toEqual(['Hours ran 64 hours past the hours priced on 2 of 3 jobs.', '1 job still open and inside its hours.'])
    expect(f.nudge).toBe('Hours ran 64 hours past the hours priced on 2 of 3 jobs. Rate them again?')
    expect(difficultyFeedbackJobWords(f.jobs[0]!)).toBe('1044 Riverside · 610 hours clocked, 562 priced · 48 hours past')
    expect(difficultyFeedbackJobWords(f.jobs[2]!)).toBe('1043 Riverside · 400 hours clocked, 420 priced · inside')
  })

  it('no nudge when every job ran inside its hours, and no hours line when the hours are not read', () => {
    const inside = buildDifficultyFeedback({ firstRatedAt: RATED, bids: [bid('a', { outcome: 'won' })], jobs: [job('1042', 500, 528)] })
    expect(inside.nudge).toBeNull()
    expect(inside.lines[2]).toBe('1 job ran inside the hours priced.')
    const hidden = buildDifficultyFeedback({ firstRatedAt: RATED, bids: [bid('a', { outcome: 'won' })], jobs: null })
    expect(hidden.lines).toHaveLength(2)
  })
})

describe('difficultyPricedHours', () => {
  it('adds the field and site lines’ hours to the bid’s field hours, never the office hours', () => {
    expect(difficultyPricedHours({ fieldHours: 480, lines: [{ key: 'field', hours: 48 }, { key: 'office', hours: 12 }, { key: 'site', hours: 19.2 }, { key: 'paying', hours: 0 }] })).toBeCloseTo(547.2)
  })
})
