import { describe, expect, it, vi } from 'vitest'
import { SUB_LABOR_DUE_EMPTY, SUB_LABOR_GAP_EMPTY, subLaborPayRunEmptyWords } from './subLaborPayRunEmptyWords'
import { plainWordsFailures } from '../plainWords'

const press = () => ({ newSheet: vi.fn(), clearSearch: vi.fn(), showDue: vi.fn() })
const base = { total: 5, search: '', matched: 5, filter: 'due' as const, dueCount: 3 }

describe('subLaborPayRunEmptyWords', () => {
  it('no sheet at all: New Sub Labor adds the first', () => {
    const p = press()
    expect(subLaborPayRunEmptyWords({ ...base, total: 0 }, p)).toEqual({ main: 'No sub sheets yet.', next: { label: 'New Sub Labor', onPress: p.newSheet }, tail: 'adds the first.' })
  })

  it('the search hid every sheet: quote it and offer Clear the search', () => {
    const p = press()
    expect(subLaborPayRunEmptyWords({ ...base, filter: 'ready', search: 'Ortiz', matched: 0 }, p)).toEqual({ main: 'No sub sheets match ‘Ortiz’.', next: { label: 'Clear the search', onPress: p.clearSearch }, tail: undefined })
    // The search left sheets and the chip hid them: the chip is named, not the search.
    expect(subLaborPayRunEmptyWords({ ...base, filter: 'ready', search: 'Ortiz', matched: 2 }, p).main).toBe('Nothing is ready to pay right now.')
  })

  it('All due and No agreement empty are the good state', () => {
    expect(subLaborPayRunEmptyWords(base, press())).toEqual({ main: SUB_LABOR_DUE_EMPTY })
    expect(subLaborPayRunEmptyWords({ ...base, filter: 'gap' }, press())).toEqual({ main: SUB_LABOR_GAP_EMPTY })
  })

  it('any other chip names itself and offers All due while sheets have money open', () => {
    const p = press()
    expect(subLaborPayRunEmptyWords({ ...base, filter: 'ready' }, p)).toEqual({ main: 'Nothing is ready to pay right now.', next: { label: 'All due', onPress: p.showDue }, tail: 'shows every sheet with money open.' })
    expect(subLaborPayRunEmptyWords({ ...base, filter: 'queued' }, p).main).toBe('Nothing under Queued.')
    expect(subLaborPayRunEmptyWords({ ...base, filter: 'wait', dueCount: 0 }, p)).toEqual({ main: 'Nothing under Waiting on customer.' })
  })

  it('every sentence is plain words', () => {
    for (const filter of ['due', 'ready', 'queued', 'wait', 'gap', 'crew', 'paid'] as const) {
      const w = subLaborPayRunEmptyWords({ ...base, filter }, press())
      expect(plainWordsFailures([w.main, w.next?.label, w.tail].filter(Boolean).join(' '))).toEqual([])
    }
  })
})
