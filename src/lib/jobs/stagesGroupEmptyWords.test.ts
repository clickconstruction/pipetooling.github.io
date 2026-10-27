import { describe, expect, it, vi } from 'vitest'
import { STAGES_GROUP_FALLBACK, stagesGroupEmptyWords, type StagesGroupEmptyContext } from './stagesGroupEmptyWords'
import { plainWordsFailures } from '../plainWords'

const ctx = (p: Partial<StagesGroupEmptyContext> = {}): StagesGroupEmptyContext => ({ group: 'Working', search: '', filtered: false, ...p })

describe('stagesGroupEmptyWords', () => {
  it('an empty group is the good state: nothing in it needs you', () => {
    expect(stagesGroupEmptyWords(ctx())).toEqual({ main: 'Nothing in Working needs you.' })
    expect(stagesGroupEmptyWords(null)).toEqual({ main: `Nothing in ${STAGES_GROUP_FALLBACK} needs you.` })
  })

  it('the board search hid the rows: quote it and offer Clear the search', () => {
    const onClearSearch = vi.fn()
    expect(stagesGroupEmptyWords(ctx({ search: ' Ridgeway ', onClearSearch }))).toEqual({ main: 'No jobs in Working match ‘Ridgeway’.', next: { label: 'Clear the search', onPress: onClearSearch }, tail: undefined })
    expect(stagesGroupEmptyWords(ctx({ search: 'Ridgeway' }))).toEqual({ main: 'No jobs in Working match ‘Ridgeway’.' })
  })

  it('a board filter hid them: say so, the chips above take them off', () => {
    expect(stagesGroupEmptyWords(ctx({ filtered: true }))).toEqual({ main: 'No jobs in Working match the filters.' })
    // The search is named first: it is the one with a press.
    expect(stagesGroupEmptyWords(ctx({ filtered: true, search: 'Elm', onClearSearch: vi.fn() })).main).toBe('No jobs in Working match ‘Elm’.')
  })

  it('Paid in Full holding nothing is a fact, not the good state', () => {
    expect(stagesGroupEmptyWords(ctx({ group: 'Paid in Full', done: true }))).toEqual({ main: 'No jobs in Paid in Full yet.' })
  })

  it('the phone strip hid every row: name the filter and offer All', () => {
    const onShowAll = vi.fn()
    expect(stagesGroupEmptyWords(ctx(), { filter: 'needs', hidden: 3, onShowAll })).toEqual({ main: 'Nothing in Working needs you.', next: { label: 'All', onPress: onShowAll }, tail: 'shows the other 3.' })
    expect(stagesGroupEmptyWords(ctx({ group: 'Ready to Bill' }), { filter: 'today', hidden: 1, onShowAll })?.main).toBe('Nothing in Ready to Bill is on today.')
    expect(stagesGroupEmptyWords(ctx(), { filter: 'needs', hidden: 2 })).toEqual({ main: 'Nothing in Working needs you.' })
    // A group with no rows at all falls through to the board's words.
    expect(stagesGroupEmptyWords(ctx({ search: 'Elm' }), { filter: 'needs', hidden: 0, onShowAll })?.main).toBe('No jobs in Working match ‘Elm’.')
  })

  it('every sentence is plain words', () => {
    const all = [
      stagesGroupEmptyWords(ctx({ group: 'Billed Awaiting Payment' })),
      stagesGroupEmptyWords(ctx({ search: 'Ridgeway', onClearSearch: vi.fn() })),
      stagesGroupEmptyWords(ctx({ filtered: true })),
      stagesGroupEmptyWords(ctx({ group: 'Paid in Full', done: true })),
      stagesGroupEmptyWords(ctx(), { filter: 'today', hidden: 4, onShowAll: vi.fn() }),
    ]
    for (const w of all) expect(plainWordsFailures([w.main, w.next?.label, w.tail].filter(Boolean).join(' '))).toEqual([])
  })
})
