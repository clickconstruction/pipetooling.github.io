import { describe, expect, it, vi } from 'vitest'
import { OFFER_HELD } from '../flows/nudgeDispatch'
import type { RatingAnswer, RatingLinkIo } from '../ratings/ratingLinkIo'
import { withRatingLink } from './offersIo'

/**
 * Customer reviews (v2.5943, punch list #185): an offer's {rate} takes its link at the press, never at the run. Since
 * v2.6007 the press keeps an answered job back first, by the one rule the morning run keeps (`ratings/ratingAsk.ts`).
 */

const LINE = 'Dana, would you tell us how we did? It takes one tap: {rate}'
const ANSWERED: RatingAnswer = { job_id: 'job-1312', answered_at: '2026-10-27T20:00:00Z' }
const links = (over: Partial<RatingLinkIo> = {}): RatingLinkIo => ({
  mint: vi.fn(async (_contact: string, _job: string | null, _name: string) => 'https://clicktooling.com/rate?t=abc'),
  asksOn: vi.fn(async (_jobIds: readonly string[]) => [] as RatingAnswer[]),
  ...over,
})

describe('withRatingLink', () => {
  it('reads the job’s asks, mints the link for the offer’s job and the person, and fills the blank', async () => {
    const io = links()
    const words = await withRatingLink(LINE, { contactId: 'c-dana', jobKey: 'pipeline:job-1312', who: 'Dana Whitfield' }, io)
    expect(words).toBe('Dana, would you tell us how we did? It takes one tap: https://clicktooling.com/rate?t=abc')
    expect(io.asksOn).toHaveBeenCalledWith(['job-1312'])
    expect(io.mint).toHaveBeenCalledWith('c-dana', 'job-1312', 'Dana Whitfield')
  })

  it('keeps a job the customer answered back: no link is minted, and the press says why', async () => {
    const io = links({ asksOn: vi.fn(async () => [ANSWERED]) })
    await expect(withRatingLink(LINE, { contactId: 'c-dana', jobKey: 'pipeline:job-1312', who: 'Dana Whitfield' }, io)).rejects.toThrow(OFFER_HELD.answered)
    expect(io.mint).not.toHaveBeenCalled()
  })

  it('mints over an unanswered ask on the job: the RPC reuses a fresh one itself', async () => {
    const io = links({ asksOn: vi.fn(async () => [{ job_id: 'job-1312', answered_at: null }]) })
    expect(await withRatingLink(LINE, { contactId: 'c-dana', jobKey: 'pipeline:job-1312' }, io)).toContain('/rate?t=abc')
    expect(io.mint).toHaveBeenCalledTimes(1)
  })

  it('leaves words with no {rate} alone, reads nothing and mints nothing', async () => {
    const io = links()
    expect(await withRatingLink('Dana, any word on the estimate?', { contactId: 'c-dana', jobKey: null }, io)).toBe('Dana, any word on the estimate?')
    expect(io.asksOn).not.toHaveBeenCalled()
    expect(io.mint).not.toHaveBeenCalled()
  })

  it('asks with no job when the offer is not a Pipeline job’s, and reads no asks for it', async () => {
    const io = links({ mint: vi.fn(async () => 'L') })
    await withRatingLink('{rate}', { contactId: 'c-1', jobKey: null }, io)
    expect(io.asksOn).not.toHaveBeenCalled()
    expect(io.mint).toHaveBeenCalledWith('c-1', null, '')
  })
})
