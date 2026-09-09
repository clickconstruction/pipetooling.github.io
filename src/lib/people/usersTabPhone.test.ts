import { describe, expect, it } from 'vitest'
import type { RailRow } from './deskRailAttention'
import type { RowNeeds } from './rowNeeds'
import {
  SWIPE_ACTION_WIDTH,
  USERS_TAB_PHONE_FILTERS,
  classifySwipe,
  countUsersTabFilter,
  isTwinEmail,
  needsYouCount,
  personInitial,
  phoneRowNote,
  swipeOffset,
  swipeSettles,
} from './usersTabPhone'

const needs = (over: Partial<RowNeeds> = {}): RowNeeds =>
  ({ hoursWaiting: 0, hoursLine: null, needs: [], attention: 'green', reasons: [], ...over }) as unknown as RowNeeds

const row = (over: Partial<RailRow>): RailRow =>
  ({ userId: 'u1', personId: null, name: 'Grace', kind: 'assistant', archived: false, attention: 'green', badge: '', reasons: [], signals: [], ...over }) as RailRow

describe('USERS_TAB_PHONE_FILTERS', () => {
  it('puts the two phone filters beside Everyone and counts only those two', () => {
    expect(USERS_TAB_PHONE_FILTERS.map((f) => f.key)).toEqual(['all', 'attention', 'hours', 'nologin', 'field', 'office'])
    expect(USERS_TAB_PHONE_FILTERS.filter((f) => f.counted).map((f) => f.key)).toEqual(['attention', 'hours'])
  })
})

describe('countUsersTabFilter', () => {
  it('counts the rows a filter would show', () => {
    const rows = [
      row({ attention: 'red', rowNeeds: needs({ hoursWaiting: 2 }) }),
      row({ userId: null, personId: 'p1', name: 'Paige', kind: 'helper', attention: 'green' }),
      row({ name: 'Wendi', kind: 'estimator', attention: 'amber', rowNeeds: needs({ hoursWaiting: 0 }) }),
    ]
    expect(countUsersTabFilter(rows, 'attention')).toBe(2)
    expect(countUsersTabFilter(rows, 'hours')).toBe(1)
    expect(countUsersTabFilter(rows, 'nologin')).toBe(1)
    expect(countUsersTabFilter(rows, 'field')).toBe(1)
    expect(countUsersTabFilter(rows, 'all')).toBe(3)
  })
})

describe('personInitial', () => {
  it('takes the first character of the first word, upper-cased', () => {
    expect(personInitial('Malachi Whites')).toBe('M')
    expect(personInitial('  wendi ')).toBe('W')
    expect(personInitial('Émile')).toBe('É')
  })
  it('is "?" for a blank name', () => {
    expect(personInitial('')).toBe('?')
    expect(personInitial(null)).toBe('?')
  })
})

describe('isTwinEmail', () => {
  it('recognises the twins domain and nothing else', () => {
    expect(isTwinEmail('twin-estimator-2@twins.pipetooling.local')).toBe(true)
    expect(isTwinEmail('wendi@clickplumbing.com')).toBe(false)
    expect(isTwinEmail(null)).toBe(false)
  })
})

describe('needsYouCount', () => {
  it('sums counted needs, at least one each, and ignores facts and hours', () => {
    const n = needs({
      hoursWaiting: 4,
      needs: [
        { subject: 'paperwork', tone: 'red', count: 2 },
        { subject: 'account', tone: 'amber', count: 0 },
        { subject: 'account', tone: 'fact', count: 0 },
      ] as unknown as RowNeeds['needs'],
    })
    expect(needsYouCount(n)).toBe(3)
    expect(needsYouCount(undefined)).toBe(0)
    expect(needsYouCount(needs())).toBe(0)
  })
})

describe('swipe geometry', () => {
  const W = SWIPE_ACTION_WIDTH * 2
  it('classifies a touch once it clears the slop, by its dominant axis', () => {
    expect(classifySwipe(2, 3)).toBe('undecided')
    expect(classifySwipe(-14, 3)).toBe('horizontal')
    expect(classifySwipe(4, 20)).toBe('vertical')
    expect(classifySwipe(-9, -9)).toBe('vertical')
  })
  it('offsets from the resting position and never leaves the actions strip', () => {
    expect(swipeOffset(-40, W, false)).toBe(-40)
    expect(swipeOffset(-500, W, false)).toBe(-W)
    expect(swipeOffset(30, W, false)).toBe(0)
    expect(swipeOffset(50, W, true)).toBe(-W + 50)
    expect(swipeOffset(-50, W, true)).toBe(-W)
  })
  it('settles open past a third of the strip and back otherwise, in both directions', () => {
    expect(swipeSettles(-43, W, false)).toBe(false)
    expect(swipeSettles(-44, W, false)).toBe(true)
    expect(swipeSettles(43, W, true)).toBe(true)
    expect(swipeSettles(44, W, true)).toBe(false)
    expect(swipeSettles(-200, W, true)).toBe(true)
  })
})

describe('phoneRowNote', () => {
  it('returns the trimmed note or null', () => {
    expect(phoneRowNote('  Master Plumber (#RMP41130) ')).toBe('Master Plumber (#RMP41130)')
    expect(phoneRowNote('   ')).toBeNull()
    expect(phoneRowNote(null)).toBeNull()
  })
})
