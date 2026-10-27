import { describe, expect, it, vi } from 'vitest'
import { TEAM_NO_EXCEPTIONS, teamWeekEmptyWords } from './teamWeekEmptyWords'
import { plainWordsFailures } from './plainWords'

describe('teamWeekEmptyWords', () => {
  it('Only exceptions on: empty is the good state', () => {
    expect(teamWeekEmptyWords({ onlyExceptions: true, nothing: 'Nothing on the board for this week.' }, vi.fn())).toEqual({ main: TEAM_NO_EXCEPTIONS })
  })

  it('an empty week offers Previous week, the pager’s own control', () => {
    const back = vi.fn()
    expect(teamWeekEmptyWords({ onlyExceptions: false, nothing: 'Nothing on the board for this week.' }, back)).toEqual({ main: 'Nothing on the board for this week.', next: { label: 'Previous week', onPress: back }, tail: 'shows the week before.' })
    expect(teamWeekEmptyWords({ onlyExceptions: false, nothing: 'Nothing to list for this week.' })).toEqual({ main: 'Nothing to list for this week.' })
  })

  it('is plain words', () => {
    expect(plainWordsFailures(`${TEAM_NO_EXCEPTIONS} Nothing on the board for this week. Previous week shows the week before.`)).toEqual([])
  })
})
