import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { googleLinkProblem, jobReviewLine, lowRatingsNeed, lowRatingsWords, monthStartYmd, needsCall, recentAnswers, REVIEWS_BLOCK_WORDS, reviewsMonth, starsGlyphs, type OfficeRating } from './ratingsOffice'

/** Wed Oct 28, 2026, 10 AM Central. */
const NOW = new Date('2026-10-28T15:00:00Z')

const row = (p: Partial<OfficeRating>): OfficeRating => ({
  id: 'r-1',
  contactId: 'c-dana',
  jobId: 'job-1312',
  customerName: 'Dana Whitfield',
  askedAt: '2026-10-27T14:12:00Z',
  openedAt: null,
  answeredAt: null,
  score: null,
  words: '',
  googlePressedAt: null,
  calledAt: null,
  callNote: '',
  ...p,
})

describe('the review ask as the office reads it (v2.5946, punch list #185)', () => {
  it('reads the job’s newest ask as asked, opened or answered', () => {
    expect(jobReviewLine([])).toBeNull()
    expect(jobReviewLine([row({})])).toMatchObject({ state: 'asked', head: 'Asked Oct 27, not opened yet', callOwed: false })
    expect(jobReviewLine([row({ openedAt: '2026-10-27T16:00:00Z' })])?.head).toBe('Asked Oct 27, opened Oct 27, not answered')
    const five = jobReviewLine([row({ answeredAt: '2026-10-27T16:05:00Z', score: 5, words: ' Luis was great. ', googlePressedAt: '2026-10-27T16:06:00Z' })])
    expect(five).toMatchObject({ state: 'answered', head: '5 stars', words: 'Luis was great.', facts: ['Oct 27', 'pressed Post it on Google'], callOwed: false })
    const low = jobReviewLine([row({ answeredAt: '2026-10-27T16:05:00Z', score: 2 })])
    expect(low?.callOwed).toBe(true)
    const called = jobReviewLine([row({ answeredAt: '2026-10-27T16:05:00Z', score: 2, calledAt: '2026-10-28T14:00:00Z', callNote: 'Going back Friday.' })])
    expect(called).toMatchObject({ callOwed: false, facts: ['Oct 27', 'called Oct 28'], callNote: 'Going back Friday.' })
    const newer = jobReviewLine([row({ id: 'old', askedAt: '2026-09-01T10:00:00Z', answeredAt: '2026-09-01T11:00:00Z', score: 1 }), row({ id: 'new' })])
    expect(newer?.state).toBe('asked')
  })

  it('a call is owed at three stars or fewer, and not after the call', () => {
    expect(needsCall({ answeredAt: 'x', score: 3, calledAt: null })).toBe(true)
    expect(needsCall({ answeredAt: 'x', score: 4, calledAt: null })).toBe(false)
    expect(needsCall({ answeredAt: null, score: 2, calledAt: null })).toBe(false)
    expect(needsCall({ answeredAt: 'x', score: 1, calledAt: 'y' })).toBe(false)
  })

  it('Needs you carries the low answers nobody called inside thirty days, the lowest and oldest first', () => {
    expect(lowRatingsNeed([row({ answeredAt: '2026-10-27T16:05:00Z', score: 5 })], NOW)).toBeNull()
    const need = lowRatingsNeed(
      [
        row({ id: 'a', customerName: 'Tom Reyes', answeredAt: '2026-10-26T16:00:00Z', score: 3 }),
        row({ id: 'b', answeredAt: '2026-10-27T16:00:00Z', score: 2, words: 'The floor was left a mess.' }),
        row({ id: 'c', answeredAt: '2026-08-01T16:00:00Z', score: 1 }),
        row({ id: 'd', answeredAt: '2026-10-27T17:00:00Z', score: 2, calledAt: '2026-10-28T14:00:00Z' }),
      ],
      NOW,
    )
    expect(need).toMatchObject({ count: 2, first: { ratingId: 'b', name: 'Dana', score: 2, words: 'The floor was left a mess.' } })
    expect(lowRatingsWords(need!)).toEqual({ title: '2 customers left three stars or fewer', detail: 'Dana first, at 2 stars. Nobody has called yet.' })
    const one = lowRatingsNeed([row({ answeredAt: '2026-10-27T16:00:00Z', score: 2, words: 'The floor was left a mess.' })], NOW)!
    expect(lowRatingsWords(one, 'job 1312')).toEqual({ title: 'Dana left 2 stars on job 1312', detail: '“The floor was left a mess.” Call them today.' })
    expect(lowRatingsWords(lowRatingsNeed([row({ answeredAt: '2026-10-27T16:00:00Z', score: 1 })], NOW)!).detail).toBe('Nobody has called yet. Call them today.')
  })

  it('counts the month in the app’s calendar', () => {
    expect(monthStartYmd(NOW)).toBe('2026-10-01')
    const m = reviewsMonth(
      [
        row({ id: 'a', askedAt: '2026-10-02T15:00:00Z', answeredAt: '2026-10-02T16:00:00Z', score: 5, googlePressedAt: '2026-10-02T16:01:00Z' }),
        row({ id: 'b', askedAt: '2026-10-10T15:00:00Z', answeredAt: '2026-10-10T16:00:00Z', score: 4 }),
        row({ id: 'c', askedAt: '2026-10-20T15:00:00Z', answeredAt: '2026-10-20T16:00:00Z', score: 2, calledAt: '2026-10-21T15:00:00Z' }),
        row({ id: 'd', askedAt: '2026-10-27T15:00:00Z' }),
        // Sep 30 at 8 PM Central is Oct 1 in UTC: it counts in September.
        row({ id: 'e', askedAt: '2026-10-01T01:00:00Z', answeredAt: '2026-10-01T01:30:00Z', score: 1 }),
      ],
      NOW,
    )
    expect(m).toEqual({ asked: 4, answered: 3, average: 3.7, googlePressed: 1, low: 1, called: 1 })
    expect(reviewsMonth([], NOW).average).toBeNull()
    expect(recentAnswers([row({ id: 'x', answeredAt: '2026-10-02T16:00:00Z', score: 5 }), row({ id: 'y', answeredAt: '2026-10-20T16:00:00Z', score: 4 }), row({ id: 'z' })]).map((r) => r.id)).toEqual(['y', 'x'])
  })

  it('checks the Google link and draws the stars', () => {
    expect(googleLinkProblem('')).toBeNull()
    expect(googleLinkProblem('https://g.page/r/abc/review')).toBeNull()
    expect(googleLinkProblem('g.page/r/abc')).toMatch(/https/)
    expect(starsGlyphs(3)).toBe('★★★☆☆')
  })

  it('reads in plain words', () => {
    for (const w of [REVIEWS_BLOCK_WORDS.hint, REVIEWS_BLOCK_WORDS.linkHelp, REVIEWS_BLOCK_WORDS.saved, REVIEWS_BLOCK_WORDS.readOnly, REVIEWS_BLOCK_WORDS.none]) expect(plainWordsFailures(w), w).toEqual([])
  })
})
