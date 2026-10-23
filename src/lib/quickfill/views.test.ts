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
  rollerDeck,
  rollerDot,
  rollerHasWork,
  rollerNext,
  rollerPrev,
  rollerWords,
  readStoredRollerShowDone,
  writeRollerShowDone,
  type FocusBucket,
} from './views'
import type { RoundRow } from './round'

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
    expect(parseQuickfillViewRequest('?view=roller')).toBe('roller')
    expect(parseQuickfillViewRequest('?view=board')).toBeNull()
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

const row = (sectionId: string, state: RoundRow['state'], count: number | null, personal = false): RoundRow => ({
  sectionId,
  label: sectionId,
  personal,
  needsNote: false,
  state,
  rhythmDays: 1,
  overDays: null,
  dueAtMs: null,
  count,
  countSource: count === null ? 'none' : 'open',
  lastMarkedAt: null,
  lastMarkedByName: null,
})
// The round's order: due first, then due today, not yet, fresh, the doors last.
const rows = [
  row('percent-complete', 'never', 6),
  row('dispatch-inbox', 'due_today', 2),
  row('warnings', 'not_yet', 0),
  row('people-hours-new', 'not_yet', 23),
  row('field-photos', 'not_yet', null),
  row('texts', 'fresh', 1),
  row('office-arriving', 'fresh', 0),
  row('schedule', 'never', null, true),
  row('my-inbox', 'never', 7, true),
]

describe('the Roller', () => {
  afterEach(() => localStorage.clear())

  it('deals everything not marked today, the doors included, and the marked ones on the switch', () => {
    expect(rollerDeck(rows, false).map((r) => r.sectionId)).toEqual(['percent-complete', 'dispatch-inbox', 'warnings', 'people-hours-new', 'field-photos', 'schedule', 'my-inbox'])
    expect(rollerDeck(rows, true).map((r) => r.sectionId)).toEqual(rows.map((r) => r.sectionId))
  })
  it('counts the work left from this group on, doors and no-count stations excluded', () => {
    const deck = rollerDeck(rows, false)
    expect(rollerWords(deck, 0)).toBe('1 of 7 · 3 left with work')
    expect(rollerWords(deck, 2)).toBe('3 of 7 · 1 left with work')
    expect(rollerWords(deck, 6)).toBe('7 of 7 · 0 left with work')
    expect(rollerWords(deck, 99)).toBe('7 of 7 · 0 left with work')
    expect(rollerWords([], 0)).toBe('Round done ✓')
    expect(rollerHasWork(row('my-inbox', 'never', 7, true))).toBe(false)
  })
  it('colours the dots by the chip rule, grey before due, hollow for a door', () => {
    expect(rollerDot(row('a', 'never', 1))).toBe('red')
    expect(rollerDot(row('a', 'due', 1))).toBe('red')
    expect(rollerDot(row('a', 'due_today', 1))).toBe('amber')
    expect(rollerDot(row('a', 'not_yet', 1))).toBe('grey')
    expect(rollerDot(row('a', 'fresh', 1))).toBe('green')
    expect(rollerDot(row('a', 'never', 1, true))).toBe('hollow')
  })
  it('walks the deck both ways and starts at the top for a station outside it', () => {
    const deck = rollerDeck(rows, false)
    expect(rollerNext(deck, null)).toBe('percent-complete')
    expect(rollerNext(deck, 'texts')).toBe('percent-complete')
    expect(rollerNext(deck, 'percent-complete')).toBe('dispatch-inbox')
    expect(rollerNext(deck, 'my-inbox')).toBeNull()
    expect(rollerPrev(deck, 'percent-complete')).toBeNull()
    expect(rollerPrev(deck, 'dispatch-inbox')).toBe('percent-complete')
    expect(rollerPrev(deck, 'texts')).toBeNull()
  })
  it('remembers the show-done switch per person on the device', () => {
    expect(readStoredRollerShowDone('u1')).toBe(false)
    writeRollerShowDone('u1', true)
    expect(readStoredRollerShowDone('u1')).toBe(true)
    expect(readStoredRollerShowDone('u2')).toBe(false)
    writeRollerShowDone('u1', false)
    expect(readStoredRollerShowDone('u1')).toBe(false)
  })
})
