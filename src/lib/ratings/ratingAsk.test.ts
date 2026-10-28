import { describe, expect, it } from 'vitest'
import { answeredAlready, answeredJobs, carriesRatingAsk, decideRatingAsk, needsRatingLink, ratingUrl, REUSE_DAYS, type RatingAskRow } from './ratingAsk'

/**
 * The review ask's one rule (v2.6007, punch list #185): the {rate} blank, the link it becomes, which texts carry the
 * ask, and that a job the customer answered is never asked again, from the morning run or from a press on Today's
 * sends alike.
 */

const NOW = new Date('2026-10-28T14:00:00Z')
const DANA = { contactId: 'c-dana', jobId: 'job-1312', now: NOW }
const ask = (over: Partial<RatingAskRow> = {}): RatingAskRow => ({
  contact_id: 'c-dana',
  job_id: 'job-1312',
  answered_at: null,
  asked_at: '2026-10-27T14:00:00Z',
  public_token: 'tok-1',
  ...over,
})

describe('the {rate} blank and the link it becomes', () => {
  it('makes the page’s link from the origin and the token, a trailing slash or not', () => {
    expect(ratingUrl('ab12', 'https://clicktooling.com')).toBe('https://clicktooling.com/rate?t=ab12')
    expect(ratingUrl('a b', 'https://clicktooling.com/')).toBe('https://clicktooling.com/rate?t=a%20b')
  })

  it('reads the ask off a text by its link or its blank, never off words a person might not type', () => {
    expect(carriesRatingAsk('Dana, thank you for paying for the water heater. Would you tell us how we did? It takes one tap: https://clicktooling.com/rate?t=ab12')).toBe(true)
    expect(carriesRatingAsk('Dana, thanks for having us out. Tell us how we did with one tap: {rate}')).toBe(true)
    expect(carriesRatingAsk('Dana, your estimate is ready. Review and approve it here: https://clicktooling.com/e/1')).toBe(false)
    expect(carriesRatingAsk('Dana, your bill is paid. Thank you.')).toBe(false)
  })

  it('needs the link only while the blank is still in the words', () => {
    expect(needsRatingLink('It takes one tap: {rate}')).toBe(true)
    expect(needsRatingLink('It takes one tap: https://clicktooling.com/rate?t=ab12')).toBe(false)
  })
})

describe('the one rule: a job the customer answered is never asked again', () => {
  it('reads an answered job, whoever on it answered, and never a job with no ask or no answer', () => {
    expect(answeredAlready([ask()], 'job-1312')).toBe(false)
    expect(answeredAlready([ask({ answered_at: '2026-10-27T20:00:00Z', contact_id: 'c-sam' })], 'job-1312')).toBe(true)
    expect(answeredAlready([ask({ answered_at: '2026-10-27T20:00:00Z' })], 'job-99')).toBe(false)
    expect(answeredAlready([ask({ answered_at: '2026-10-27T20:00:00Z', job_id: null })], null)).toBe(false)
    expect(answeredAlready([], 'job-1312')).toBe(false)
  })

  it('names the jobs answered among many asks, so Today’s sends can hold each one’s offer', () => {
    expect(answeredJobs([ask(), ask({ job_id: 'job-2', answered_at: '2026-10-27T20:00:00Z' }), ask({ job_id: null, answered_at: '2026-10-27T20:00:00Z' })])).toEqual(new Set(['job-2']))
    expect(answeredJobs([])).toEqual(new Set())
  })

  it('refuses an answered job even when a fresh unanswered ask sits beside the answer', () => {
    expect(decideRatingAsk([ask({ answered_at: '2026-10-27T20:00:00Z' }), ask({ public_token: 'tok-2' })], DANA)).toEqual({ refused: 'answered' })
  })

  it('reuses the newest fresh unanswered ask to the same person about the same job, inside the reuse days', () => {
    expect(REUSE_DAYS).toBe(30)
    expect(decideRatingAsk([ask({ public_token: 'old', asked_at: '2026-10-20T14:00:00Z' }), ask({ public_token: 'new', asked_at: '2026-10-27T14:00:00Z' })], DANA)).toEqual({ reuse: 'new' })
    expect(decideRatingAsk([ask({ asked_at: '2026-09-29T14:00:01Z' })], DANA)).toEqual({ reuse: 'tok-1' })
  })

  it('mints anew when the asks are stale, another person’s, another job’s, or none', () => {
    expect(decideRatingAsk([ask({ asked_at: '2026-09-20T14:00:00Z' })], DANA)).toEqual({ mint: true })
    expect(decideRatingAsk([ask({ contact_id: 'c-sam' })], DANA)).toEqual({ mint: true })
    expect(decideRatingAsk([ask({ job_id: 'job-2' })], DANA)).toEqual({ mint: true })
    expect(decideRatingAsk([], DANA)).toEqual({ mint: true })
  })

  it('an ask on the person alone reuses only one on the person alone', () => {
    const alone = { ...DANA, jobId: null }
    expect(decideRatingAsk([ask()], alone)).toEqual({ mint: true })
    expect(decideRatingAsk([ask({ job_id: null, public_token: 'tok-p' })], alone)).toEqual({ reuse: 'tok-p' })
  })
})
