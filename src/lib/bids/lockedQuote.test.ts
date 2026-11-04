import { describe, expect, it } from 'vitest'
import { quoteToShow, sentTagWords, sentValueOf } from './lockedQuote'

describe('quoteToShow — a locked bid says what went out (v2.6510)', () => {
  it('locked with a sent value: the sent figure, whatever the book prices it at today', () => {
    expect(quoteToShow({ lockState: 'locked', bidValue: 156513.97, live: 145600.87 })).toEqual({ amount: 156513.97, source: 'sent' })
    expect(quoteToShow({ lockState: 'locked', bidValue: '156513.97', live: null })).toEqual({ amount: 156513.97, source: 'sent' })
  })
  it('revising, or never sent: the live figure', () => {
    expect(quoteToShow({ lockState: 'revising', bidValue: 156513.97, live: 154561.79 })).toEqual({ amount: 154561.79, source: 'live' })
    expect(quoteToShow({ lockState: 'open', bidValue: null, live: 1200 })).toEqual({ amount: 1200, source: 'live' })
  })
  it('locked with no sent value stamped, or a zero: the live figure, null while it loads', () => {
    expect(quoteToShow({ lockState: 'locked', bidValue: null, live: 1200 })).toEqual({ amount: 1200, source: 'live' })
    expect(quoteToShow({ lockState: 'locked', bidValue: 0, live: 1200 })).toEqual({ amount: 1200, source: 'live' })
    expect(quoteToShow({ lockState: 'locked', bidValue: 'abc', live: null })).toBeNull()
    expect(quoteToShow({ lockState: 'open', bidValue: 50, live: undefined })).toBeNull()
  })
  it('sentValueOf reads a number or a numeric string and refuses the rest', () => {
    expect(sentValueOf(12.5)).toBe(12.5)
    expect(sentValueOf('12.50')).toBe(12.5)
    expect(sentValueOf(-1)).toBeNull()
    expect(sentValueOf(Number.NaN)).toBeNull()
    expect(sentValueOf(undefined)).toBeNull()
  })
  it('the tag rides the sent figure only', () => {
    expect(sentTagWords({ amount: 1, source: 'sent' })).toBe('as sent')
    expect(sentTagWords({ amount: 1, source: 'live' })).toBeNull()
    expect(sentTagWords(null)).toBeNull()
  })
})
