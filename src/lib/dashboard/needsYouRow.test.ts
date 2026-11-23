import { describe, expect, it } from 'vitest'
import { NEEDS_YOU_PRESS_COLUMN, NEEDS_YOU_PRESS_MIN_HEIGHT, needsYouFigureInTitle, needsYouPhoneFigure } from './needsYouRow'

describe('needsYouFigureInTitle', () => {
  it('finds a count the title leads with or carries inside', () => {
    expect(needsYouFigureInTitle('14 purchases need a job', '14')).toBe(true)
    expect(needsYouFigureInTitle('Allocate 2 bank deposits', '2')).toBe(true)
    expect(needsYouFigureInTitle('Sign 3 lien notices before the run', '3')).toBe(true)
  })

  it('finds a money figure and a capped count written as the title writes them', () => {
    expect(needsYouFigureInTitle('$1,240 of material walked away this week', '$1,240')).toBe(true)
    expect(needsYouFigureInTitle('99+ texts are waiting', '99+')).toBe(true)
  })

  it('never reads a number inside a longer number, an amount or a percent', () => {
    expect(needsYouFigureInTitle('19 boxes not counted', '9')).toBe(false)
    expect(needsYouFigureInTitle('91 boxes not counted', '9')).toBe(false)
    expect(needsYouFigureInTitle('$2,400 is past due', '2')).toBe(false)
    expect(needsYouFigureInTitle('1,240 parts have no price', '1')).toBe(false)
    expect(needsYouFigureInTitle('Field capacity has run under 60% three weeks running', '60')).toBe(false)
    expect(needsYouFigureInTitle('2.5 hours are unapproved', '2')).toBe(false)
  })

  it('a title with no number, or an empty figure, has nothing to find', () => {
    expect(needsYouFigureInTitle('Customers', '4')).toBe(false)
    expect(needsYouFigureInTitle('4 customers', ' ')).toBe(false)
  })
})

describe('needsYouPhoneFigure', () => {
  it('draws the figure only when the title does not already say it', () => {
    expect(needsYouPhoneFigure({ title: 'Customers', figure: '4' })).toBe('4')
    expect(needsYouPhoneFigure({ title: 'Field capacity has run under 60% three weeks running', figure: '48%' })).toBe('48%')
    expect(needsYouPhoneFigure({ title: '14 purchases need a job', figure: '14' })).toBeNull()
    expect(needsYouPhoneFigure({ title: 'A mailed notice has no tracking number', figure: '' })).toBeNull()
  })
})

describe('the press column', () => {
  it('is one width for every row, bounded both ways, and a thumb tall', () => {
    // A clamp with fixed ends: no label can widen it, and a narrow phone can only take it down to the floor.
    expect(NEEDS_YOU_PRESS_COLUMN).toMatch(/^clamp\(5\.25rem, \d+vw, 6\.5rem\)$/)
    expect(NEEDS_YOU_PRESS_MIN_HEIGHT).toBeGreaterThanOrEqual(44)
  })
})
