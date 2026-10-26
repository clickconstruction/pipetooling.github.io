import { describe, expect, it } from 'vitest'
import { reviewEventLine, reviewJobWord, reviewQuote } from '../../supabase/functions/_shared/reviewEventLine'

const INPUT = { reviewId: 'r-1', customerName: 'Dana Whitfield', jobWord: 'job 1312' }

describe('reviewEventLine (v2.5896, punch list #185)', () => {
  it('names a good review with the star mark and a low one with the warning, each keyed once per review', () => {
    expect(reviewEventLine('answered', { ...INPUT, stars: 5, words: 'Luis was in and out in an hour.' })).toEqual({
      body: '⭐ Dana left 5 stars on job 1312: “Luis was in and out in an hour.”',
      key: 'review:r-1:answered',
    })
    expect(reviewEventLine('answered', { ...INPUT, stars: 2, words: null })?.body).toBe('⚠ Dana left 2 stars on job 1312.')
    expect(reviewEventLine('answered', { ...INPUT, stars: 1 })?.body).toBe('⚠ Dana left 1 star on job 1312.')
    expect(reviewEventLine('answered', { ...INPUT, stars: 4 })?.body.startsWith('⭐')).toBe(true)
    expect(reviewEventLine('answered', { ...INPUT, stars: null })).toBeNull()
  })

  it('quotes what we could have done better, and says nothing when they typed nothing', () => {
    expect(reviewEventLine('better', { ...INPUT, better: 'Wipe the floor before you go.' })).toEqual({
      body: '⚠ What Dana says we could have done better on job 1312: “Wipe the floor before you go.”',
      key: 'review:r-1:better',
    })
    expect(reviewEventLine('better', { ...INPUT, better: '   ' })).toBeNull()
  })

  it('records the Google press, and falls back to The customer with no name', () => {
    expect(reviewEventLine('google', INPUT)).toEqual({ body: '⭐ Dana pressed Post it on Google.', key: 'review:r-1:google' })
    expect(reviewEventLine('google', { ...INPUT, customerName: null })?.body).toBe('⭐ The customer pressed Post it on Google.')
  })

  it('collapses the quote to one line and cuts it at 280 characters', () => {
    expect(reviewQuote('  two\n lines  ')).toBe('two lines')
    expect(reviewQuote(null)).toBeNull()
    const long = reviewQuote('x'.repeat(400))!
    expect(long.length).toBe(280)
    expect(long.endsWith('…')).toBe(true)
  })

  it('names the job by its number, else its name, else the job', () => {
    expect(reviewJobWord({ click_number: '1312', hcp_number: null, job_name: 'Water heater' })).toBe('job 1312')
    expect(reviewJobWord({ click_number: null, hcp_number: '4471', job_name: null })).toBe('job 4471')
    expect(reviewJobWord({ click_number: null, hcp_number: null, job_name: 'the water heater' })).toBe('the water heater')
    expect(reviewJobWord(null)).toBe('the job')
  })
})
