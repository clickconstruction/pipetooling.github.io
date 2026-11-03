import { describe, expect, it } from 'vitest'
import { lookFigure } from './lookFigure'

describe('lookFigure', () => {
  it('leads with the amber words’ number when something waits', () => {
    expect(lookFigure({ count: '12', need: '3 likely pairs' })).toBe('3')
    expect(lookFigure({ count: '1 set', need: '24 jobs on no part' })).toBe('24')
  })
  it('falls back to the count’s number', () => {
    expect(lookFigure({ count: '0 new', need: null })).toBe('0')
    expect(lookFigure({ count: '0', need: null })).toBe('0')
  })
  it('rounds money from ten thousand up to fit a phone cell', () => {
    expect(lookFigure({ count: '$186,116.84 left', need: '  ' })).toBe('$186k')
    expect(lookFigure({ count: '$9,950.00 left', need: null })).toBe('$9,950')
    expect(lookFigure({ count: '$2,197,171.58 left', need: null })).toBe('$2.2M')
    expect(lookFigure({ count: '$12,000,000 left', need: null })).toBe('$12M')
    expect(lookFigure({ count: '$3,000,000 left', need: null })).toBe('$3M')
  })
  it('keeps words that carry no number', () => {
    expect(lookFigure({ count: 'none', need: null })).toBe('none')
  })
})
