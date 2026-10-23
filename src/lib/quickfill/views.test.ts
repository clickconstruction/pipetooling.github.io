// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
  focusBucket,
  focusGroups,
  focusHeading,
  focusHeadline,
  parseQuickfillViewRequest,
  quickfillViewStorageKey,
  readStoredQuickfillView,
  writeQuickfillView,
  type FocusBucket,
} from './views'

const base = { count: 3, loading: false, collapsed: false, personal: false, forced: false }

describe('focusBucket', () => {
  it('keeps a station with work open', () => {
    expect(focusBucket(base)).toBe('open')
  })
  it('folds a station at zero', () => {
    expect(focusBucket({ ...base, count: 0 })).toBe('zero')
  })
  it('never folds on a count that is still loading', () => {
    expect(focusBucket({ ...base, count: null, loading: true })).toBe('open')
    expect(focusBucket({ ...base, count: 0, loading: true })).toBe('open')
  })
  it('keeps a station with no reporter open, since the page cannot say it is empty', () => {
    expect(focusBucket({ ...base, count: null })).toBe('open')
  })
  it('puts a marked station with the fresh strips, even at zero', () => {
    expect(focusBucket({ ...base, count: 0, collapsed: true })).toBe('fresh')
  })
  it('puts a personal door with the doors, whatever it counts', () => {
    expect(focusBucket({ ...base, personal: true })).toBe('door')
    expect(focusBucket({ ...base, personal: true, count: 0 })).toBe('door')
  })
  it('opens anything the person asked for: Open now or a station deep link', () => {
    expect(focusBucket({ ...base, count: 0, forced: true })).toBe('open')
    expect(focusBucket({ ...base, collapsed: true, forced: true })).toBe('open')
    expect(focusBucket({ ...base, personal: true, forced: true })).toBe('open')
  })
})

describe('focusGroups + the words', () => {
  const sections = [
    { sectionId: 'warnings' },
    { sectionId: 'dispatch-inbox' },
    { sectionId: 'my-inbox' },
    { sectionId: 'texts' },
    { sectionId: 'vehicle-odometers' },
  ]
  const bucketOf = (id: string): FocusBucket => (id === 'warnings' ? 'zero' : id === 'my-inbox' ? 'door' : id === 'texts' ? 'fresh' : 'open')

  it('splits in page order and keeps every station', () => {
    const g = focusGroups(sections, bucketOf)
    expect(g.open.map((s) => s.sectionId)).toEqual(['dispatch-inbox', 'vehicle-odometers'])
    expect(g.zero.map((s) => s.sectionId)).toEqual(['warnings'])
    expect(g.fresh.map((s) => s.sectionId)).toEqual(['texts'])
    expect(g.door.map((s) => s.sectionId)).toEqual(['my-inbox'])
    expect(g.open.length + g.zero.length + g.fresh.length + g.door.length).toBe(sections.length)
  })
  it('writes the headline with only the parts that exist', () => {
    expect(focusHeadline(focusGroups(sections, bucketOf))).toBe('2 groups with work · 1 at zero · 1 marked today · 1 door')
    expect(focusHeadline({ open: [{}], zero: [], fresh: [], door: [] })).toBe('1 group with work')
    expect(focusHeadline({ open: [], zero: [{}, {}], fresh: [], door: [{}, {}, {}] })).toBe('0 groups with work · 2 at zero · 3 doors')
  })
  it('names each folded run', () => {
    expect(focusHeading('zero', 7)).toBe('7 at zero · still get a ✓')
    expect(focusHeading('fresh', 5)).toBe('5 marked today')
    expect(focusHeading('door', 1)).toBe('1 door · no mark')
    expect(focusHeading('door', 3)).toBe('3 doors · no mark')
  })
})

describe('the view on the URL and on the device', () => {
  afterEach(() => localStorage.clear())

  it('reads ?view= and ignores anything it does not know', () => {
    expect(parseQuickfillViewRequest('?view=focus')).toBe('focus')
    expect(parseQuickfillViewRequest('view=page&station=texts')).toBe('page')
    expect(parseQuickfillViewRequest('?view=roller')).toBeNull()
    expect(parseQuickfillViewRequest('')).toBeNull()
  })
  it('remembers per person on the device and reads nothing for nobody', () => {
    expect(readStoredQuickfillView('u1')).toBeNull()
    writeQuickfillView('u1', 'focus')
    expect(localStorage.getItem(quickfillViewStorageKey('u1'))).toBe('focus')
    expect(readStoredQuickfillView('u1')).toBe('focus')
    expect(readStoredQuickfillView('u2')).toBeNull()
    expect(readStoredQuickfillView(null)).toBeNull()
    localStorage.setItem(quickfillViewStorageKey('u1'), 'junk')
    expect(readStoredQuickfillView('u1')).toBeNull()
  })
})
