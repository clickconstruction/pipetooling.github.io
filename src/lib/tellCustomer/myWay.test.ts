import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { MY_WAY_DEFAULT, MY_WAY_MOMENTS, MY_WAY_WORDS, myWayFor, myWaysFrom } from './myWay'

describe('my way (v2.5597)', () => {
  it('asks first until the person says otherwise, reads a row fail-soft, and a moved visit follows the booking', () => {
    expect(MY_WAY_DEFAULT).toEqual({ booked: 'ask', estimate: 'ask' })
    expect(myWaysFrom(null)).toEqual(MY_WAY_DEFAULT)
    expect(myWaysFrom({ booked: 'send', estimate: 'nope' })).toEqual({ booked: 'send', estimate: 'ask' })
    expect(myWayFor({ booked: 'send', estimate: 'ask' }, 'rescheduled')).toBe('send')
    expect(myWayFor({ booked: 'ask', estimate: 'send' }, 'estimate')).toBe('send')
    expect(MY_WAY_MOMENTS).toEqual(['booked', 'estimate'])
  })

  it('keeps to plain words', () => {
    const words = [MY_WAY_WORDS.title, MY_WAY_WORDS.hint, MY_WAY_WORDS.sentMyWay, ...Object.values(MY_WAY_WORDS.moment), ...Object.values(MY_WAY_WORDS.way), MY_WAY_WORDS.saved('booked', 'send'), MY_WAY_WORDS.saved('estimate', 'ask')]
    for (const w of words) expect(plainWordsFailures(w), w).toEqual([])
  })
})
