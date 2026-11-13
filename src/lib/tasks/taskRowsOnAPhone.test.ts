import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { DONE_WHEN_HINT, DONE_WHEN_HINT_MAX, showsFourWeeks } from './taskRowsOnAPhone'

describe('DONE_WHEN_HINT', () => {
  it('is one sentence a window, short enough for one line on a phone', () => {
    for (const hint of Object.values(DONE_WHEN_HINT)) {
      expect(hint.length).toBeLessThanOrEqual(DONE_WHEN_HINT_MAX)
      expect(hint.match(/[.!?]/g)).toHaveLength(1)
      expect(hint.endsWith('.')).toBe(true)
    }
  })

  it('says a card in the windows that make a card, and a task on the roadmap', () => {
    expect(DONE_WHEN_HINT.add).toBe('The card reads its percent from the ticks.')
    expect(DONE_WHEN_HINT.roadmap).toBe('The task reads its percent from the ticks.')
  })

  it('tells the editor what taking a line off does, which only Edit task can do', () => {
    expect(DONE_WHEN_HINT.edit).toBe('A line taken off keeps the ticks already on it.')
  })

  it('keeps to plain words', () => {
    for (const hint of Object.values(DONE_WHEN_HINT)) expect(plainWordsFailures(hint)).toEqual([])
  })
})

describe('showsFourWeeks', () => {
  const oneTime = { repeats: false, hasDue: false, choice: 'day' as const, startInPast: false }

  it('always draws for a task that repeats, on a phone and at a desk', () => {
    expect(showsFourWeeks({ ...oneTime, repeats: true, choice: 'repeat', phone: true })).toBe(true)
    expect(showsFourWeeks({ ...oneTime, repeats: true, choice: 'repeat', phone: false })).toBe(true)
  })

  it('does not draw for a one-time task on a phone, picked day or due day', () => {
    expect(showsFourWeeks({ ...oneTime, phone: true })).toBe(false)
    expect(showsFourWeeks({ ...oneTime, phone: true, hasDue: true })).toBe(false)
    expect(showsFourWeeks({ ...oneTime, phone: true, choice: 'today' })).toBe(false)
  })

  it('draws for a picked day and a due day at a desk, as it has since #217', () => {
    expect(showsFourWeeks({ ...oneTime, phone: false })).toBe(true)
    expect(showsFourWeeks({ ...oneTime, phone: false, choice: 'today', hasDue: true })).toBe(true)
    expect(showsFourWeeks({ ...oneTime, phone: false, choice: 'tomorrow', hasDue: true })).toBe(true)
  })

  it('does not draw for Tomorrow or a day that has passed, at a desk with no due day', () => {
    expect(showsFourWeeks({ ...oneTime, phone: false, choice: 'tomorrow' })).toBe(false)
    expect(showsFourWeeks({ ...oneTime, phone: false, startInPast: true })).toBe(false)
  })
})
