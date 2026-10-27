import { describe, expect, it } from 'vitest'
import { ratingEventLine, ratingJobWord, ratingQuote } from '../../supabase/functions/_shared/ratingEventLine'
import { plainWordsFailures } from './plainWords'

const INPUT = { ratingId: 'r-1', customerName: 'Dana Whitfield', jobWord: 'job 1312' }

describe('ratingEventLine (v2.5934, punch list #185)', () => {
  it('names an answer with the star mark from four up and the warning below, keyed once per rating', () => {
    expect(ratingEventLine('answered', { ...INPUT, score: 5 })).toEqual({ body: '⭐ Dana left 5 stars on job 1312.', key: 'rating:r-1:answered' })
    expect(ratingEventLine('answered', { ...INPUT, score: 4 })?.body).toBe('⭐ Dana left 4 stars on job 1312.')
    expect(ratingEventLine('answered', { ...INPUT, score: 2 })?.body).toBe('⚠ Dana left 2 stars on job 1312.')
    expect(ratingEventLine('answered', { ...INPUT, score: 1, jobWord: null })?.body).toBe('⚠ Dana left 1 star.')
    expect(ratingEventLine('answered', { ...INPUT, score: null })).toBeNull()
  })

  it('keys a changed score by the score it lands on, so tapping around writes at most five lines', () => {
    expect(ratingEventLine('changed', { ...INPUT, score: 3 })).toEqual({ body: '⚠ Dana changed the answer to 3 stars on job 1312.', key: 'rating:r-1:score:3' })
    expect(ratingEventLine('changed', { ...INPUT, score: 5 })?.key).toBe('rating:r-1:score:5')
  })

  it('quotes the words: a five as what they wrote, below five as what we could have done better', () => {
    expect(ratingEventLine('words', { ...INPUT, score: 5, words: 'Luis was in and out in an hour.' })).toEqual({
      body: '⭐ Dana wrote on job 1312: “Luis was in and out in an hour.”',
      key: 'rating:r-1:words',
    })
    expect(ratingEventLine('words', { ...INPUT, score: 2, words: 'The floor was left a mess.' })?.body).toBe('⚠ What Dana says we could have done better on job 1312: “The floor was left a mess.”')
    expect(ratingEventLine('words', { ...INPUT, score: 4, words: 'Call before you come.' })?.body).toBe('⭐ What Dana says we could have done better on job 1312: “Call before you come.”')
    expect(ratingEventLine('words', { ...INPUT, score: 5, words: '  ' })).toBeNull()
  })

  it('records the Google press, and falls back to The customer with no name', () => {
    expect(ratingEventLine('google', INPUT)).toEqual({ body: '⭐ Dana pressed Post it on Google.', key: 'rating:r-1:google' })
    expect(ratingEventLine('google', { ...INPUT, customerName: null })?.body).toBe('⭐ The customer pressed Post it on Google.')
  })

  it('collapses a quote to one line, cuts it at 280 characters, and names the job by number, then name', () => {
    expect(ratingQuote('  two\n lines  ')).toBe('two lines')
    expect(ratingQuote(null)).toBeNull()
    const long = ratingQuote('x'.repeat(400))!
    expect(long.length).toBe(280)
    expect(long.endsWith('…')).toBe(true)
    expect(ratingJobWord({ click_number: '1312', job_name: 'Water heater' })).toBe('job 1312')
    expect(ratingJobWord({ click_number: null, hcp_number: '4471' })).toBe('job 4471')
    expect(ratingJobWord({ job_name: 'the water heater' })).toBe('the water heater')
    expect(ratingJobWord(null)).toBeNull()
  })

  it('reads in plain words', () => {
    const lines = [
      ratingEventLine('answered', { ...INPUT, score: 5 })!.body,
      ratingEventLine('changed', { ...INPUT, score: 3 })!.body,
      ratingEventLine('google', INPUT)!.body,
    ]
    for (const l of lines) expect(plainWordsFailures(l), l).toEqual([])
  })
})
