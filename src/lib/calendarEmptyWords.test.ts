import { describe, expect, it } from 'vitest'
import type { EmptyStateWords } from './emptyWords'
import { plainWordsFailures } from './plainWords'
import { CALENDAR_UPCOMING_EMPTY, SCHEDULE_HUB_PATH, calendarMyDayEmptyWords } from './calendarEmptyWords'

const read = (w: EmptyStateWords) => [w.main, w.next?.label, w.tail].filter(Boolean).join(' ')

describe('calendarEmptyWords', () => {
  it('My Day: the Schedule hub for a role that opens it, the sentence alone for the rest', () => {
    expect(calendarMyDayEmptyWords(true).next).toEqual({ label: 'Schedule hub', to: SCHEDULE_HUB_PATH })
    expect(read(calendarMyDayEmptyWords(true))).toBe('Nothing planned for this day. Schedule hub plans the next block.')
    expect(calendarMyDayEmptyWords(false)).toEqual({ main: 'Nothing planned for this day.' })
  })

  it('every sentence reads in plain words', () => {
    for (const w of [calendarMyDayEmptyWords(true), calendarMyDayEmptyWords(false), CALENDAR_UPCOMING_EMPTY]) {
      expect(plainWordsFailures(read(w)), read(w)).toEqual([])
    }
  })
})
