import { describe, expect, it } from 'vitest'
import { NEEDS_YOU_PRESS_MIN_HEIGHT, NEEDS_YOU_PRESS_TOUCH_PAD_PX, needsYouFigureInTitle, needsYouPhoneFigure } from './needsYouRow'

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

  it('a row that shows its values is read by the title it draws, the count marked inside it', () => {
    const shown = { title: '⟪n|3⟫ texts to send', names: '', peek: null, chips: [] }
    // The plain title says no number, but the drawn one leads with 3: no second 3 beside the press.
    expect(needsYouPhoneFigure({ title: 'Today’s sends', figure: '3', shown })).toBeNull()
    expect(needsYouPhoneFigure({ title: 'Today’s sends', figure: '4', shown })).toBe('4')
  })
})

describe('the press on a phone', () => {
  it('has a thumb-tall touch area, and gives back what that adds so the row is no taller', () => {
    expect(NEEDS_YOU_PRESS_MIN_HEIGHT).toBeGreaterThanOrEqual(44)
    // A pill of about 32 px inside a 44 px touch area leaves 6 px above and under it.
    expect(NEEDS_YOU_PRESS_TOUCH_PAD_PX * 2).toBeLessThanOrEqual(NEEDS_YOU_PRESS_MIN_HEIGHT - 30)
  })
})
