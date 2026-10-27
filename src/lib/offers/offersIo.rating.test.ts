import { describe, expect, it, vi } from 'vitest'
import { withRatingLink } from './offersIo'

/** Customer reviews (v2.5943, punch list #185): an offer's {rate} takes its link at the press, never at the run. */
describe('withRatingLink', () => {
  it('mints the link for the offer’s job and the person, and fills the blank', async () => {
    const mint = vi.fn(async (_contact: string, _job: string | null, _name: string) => 'https://clicktooling.com/rate?t=abc')
    const words = await withRatingLink('Dana, would you tell us how we did? It takes one tap: {rate}', { contactId: 'c-dana', jobKey: 'pipeline:job-1312', who: 'Dana Whitfield' }, { mint })
    expect(words).toBe('Dana, would you tell us how we did? It takes one tap: https://clicktooling.com/rate?t=abc')
    expect(mint).toHaveBeenCalledWith('c-dana', 'job-1312', 'Dana Whitfield')
  })

  it('leaves words with no {rate} alone and mints nothing', async () => {
    const mint = vi.fn(async () => 'x')
    expect(await withRatingLink('Dana, any word on the estimate?', { contactId: 'c-dana', jobKey: null }, { mint })).toBe('Dana, any word on the estimate?')
    expect(mint).not.toHaveBeenCalled()
  })

  it('asks with no job when the offer is not a Pipeline job’s', async () => {
    const mint = vi.fn(async (_contact: string, _job: string | null, _name: string) => 'L')
    await withRatingLink('{rate}', { contactId: 'c-1', jobKey: null }, { mint })
    expect(mint).toHaveBeenCalledWith('c-1', null, '')
  })
})
