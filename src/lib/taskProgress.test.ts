import { describe, expect, it } from 'vitest'
import {
  PERCENT_CHIPS,
  asksForPhotoDefault,
  cardAsksForPhoto,
  clampPercent,
  finishRule,
  fractionWords,
  linesWords,
  percentFromTicks,
  photoAsk,
  progressLine,
  ringState,
  ringWords,
  slotFill,
  stageFraction,
  takesRing,
  whatIsLeftWords,
} from './taskProgress'

describe('takesRing', () => {
  it('a one-off card and a roadmap card take the ring; a repeating card keeps the tick', () => {
    expect(takesRing({ repeatType: 'once' })).toBe(true)
    expect(takesRing({ repeatType: 'weekly', roadmapTaskId: 't1' })).toBe(true)
    expect(takesRing({ repeatType: 'weekly' })).toBe(false)
    expect(takesRing({ repeatType: 'daily' })).toBe(false)
    expect(takesRing({ repeatType: 'days_after_completion' })).toBe(false)
    expect(takesRing({ repeatType: null })).toBe(true)
  })
})

describe('clampPercent and percentFromTicks', () => {
  it('holds a percent to a whole number 0 to 100', () => {
    expect(clampPercent(75)).toBe(75)
    expect(clampPercent(140)).toBe(100)
    expect(clampPercent(-5)).toBe(0)
    expect(clampPercent('66.6')).toBe(67)
    expect(clampPercent(null)).toBe(0)
    expect(clampPercent(NaN)).toBe(0)
  })
  it('reads the ticks as 2 of 3 is 67', () => {
    expect(percentFromTicks(2, 3)).toBe(67)
    expect(percentFromTicks(1, 3)).toBe(33)
    expect(percentFromTicks(3, 3)).toBe(100)
    expect(percentFromTicks(5, 3)).toBe(100)
    expect(percentFromTicks(0, 0)).toBe(0)
  })
})

describe('ringState', () => {
  it('a done row is 100 whatever is stored', () => {
    const s = ringState({ completedAt: '2026-11-06T15:00:00Z', percentComplete: 40, lines: 0, ticked: 0 })
    expect(s).toMatchObject({ percent: 100, done: true, derived: false, untouched: false })
    expect(ringWords(s)).toBe('Done')
  })
  it('a card with lines reads the ticks, never the hand', () => {
    const s = ringState({ completedAt: null, percentComplete: 10, lines: 3, ticked: 2 })
    expect(s).toMatchObject({ percent: 67, derived: true, lines: 3, ticked: 2, untouched: false })
    expect(ringWords(s)).toBe('67% done, 2 of 3 lines')
    expect(linesWords(2, 3)).toBe('2 of 3 done when…')
  })
  it('a card without lines reads the hand', () => {
    const s = ringState({ completedAt: null, percentComplete: 50, lines: 0, ticked: 0 })
    expect(s).toMatchObject({ percent: 50, derived: false, untouched: false })
    expect(ringWords(s)).toBe('50% done')
  })
  it('an untouched card is an empty ring with no digits', () => {
    expect(ringState({ completedAt: null, percentComplete: 0, lines: 0, ticked: 0 }).untouched).toBe(true)
    expect(ringWords(ringState({ completedAt: null, percentComplete: 0, lines: 0, ticked: 0 }))).toBe('Not started')
    expect(ringWords(ringState({ completedAt: null, percentComplete: 0, lines: 4, ticked: 0 }))).toBe('Not started, 0 of 4 lines')
  })
  it('the chips are 25, 50 and 75; Done is its own press', () => {
    expect([...PERCENT_CHIPS]).toEqual([25, 50, 75])
  })
})

describe('the photo ask', () => {
  it('is offered at every percent and required at the finish only on a card that asks', () => {
    expect(photoAsk({ asksForPhoto: false }, 'percent')).toBe('offered')
    expect(photoAsk({ asksForPhoto: true }, 'percent')).toBe('offered')
    expect(photoAsk({ asksForPhoto: true }, 'finish')).toBe('required')
    expect(photoAsk({ asksForPhoto: false }, 'finish')).toBe('none')
  })
  it('turns on by itself once a line is written', () => {
    expect(asksForPhotoDefault(0)).toBe(false)
    expect(asksForPhotoDefault(1)).toBe(true)
  })
  it('a card reads its own switch or its roadmap task’s', () => {
    expect(cardAsksForPhoto({ asksForPhoto: false }, { asksForPhoto: true })).toBe(true)
    expect(cardAsksForPhoto({ asksForPhoto: true }, null)).toBe(true)
    expect(cardAsksForPhoto({ asksForPhoto: false }, null)).toBe(false)
    expect(cardAsksForPhoto({}, undefined)).toBe(false)
  })
  it('the finishing sheet holds until a photo is in or a reason is typed', () => {
    expect(finishRule({ asksForPhoto: true }, false, '')).toEqual({ ok: false, pressWords: 'Photo first', holds: true })
    expect(finishRule({ asksForPhoto: true }, false, '  ')).toMatchObject({ ok: false })
    expect(finishRule({ asksForPhoto: true }, true, '')).toMatchObject({ ok: true, pressWords: 'Done · 100%' })
    expect(finishRule({ asksForPhoto: true }, false, 'camera broke')).toMatchObject({ ok: true })
    expect(finishRule({ asksForPhoto: false }, false, '')).toMatchObject({ ok: true, holds: false })
  })
})

describe('the progress line', () => {
  it('carries the name, the percent, the time and the words when there are any', () => {
    expect(progressLine({ name: 'Mateo', percent: 75, words: '  puddy and  the glue,\nThursday ', when: 'Wed 2:05 PM' })).toBe(
      'Mateo · 75% · Wed 2:05 PM · "puddy and the glue, Thursday"',
    )
    expect(progressLine({ name: '', percent: 50, words: '', when: '3:12 PM' })).toBe('Someone · 50% · 3:12 PM')
  })
  it('keeps the words to one line of the sheet’s length', () => {
    expect(whatIsLeftWords('x'.repeat(200))).toHaveLength(140)
    expect(whatIsLeftWords('a\n\nb')).toBe('a b')
  })
})

describe('a stage’s fractions', () => {
  it('adds done tasks as one and open tasks as their percent', () => {
    const f = stageFraction([
      { completedAt: 'x', percentComplete: 0 },
      { completedAt: 'x', percentComplete: 30 },
      { completedAt: null, percentComplete: 50 },
      { completedAt: null, percentComplete: 0 },
      { completedAt: null, percentComplete: null },
      { completedAt: null, percentComplete: 0 },
    ])
    expect(f).toEqual({ done: 2.5, total: 6, words: '2.5 of 6 done' })
  })
  it('reads whole numbers plainly and rounds to one place', () => {
    expect(fractionWords(2)).toBe('2')
    expect(fractionWords(2.5)).toBe('2.5')
    expect(fractionWords(2.666)).toBe('2.7')
    expect(stageFraction([]).words).toBe('0 of 0 done')
  })
  it('a slot fills to its task’s percent, or full when done', () => {
    expect(slotFill({ completedAt: 'x', percentComplete: 10 })).toBe(100)
    expect(slotFill({ completedAt: null, percentComplete: 50 })).toBe(50)
    expect(slotFill({ completedAt: null, percentComplete: undefined })).toBe(0)
  })
})
