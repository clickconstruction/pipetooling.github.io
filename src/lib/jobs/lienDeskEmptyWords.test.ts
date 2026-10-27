import { describe, expect, it, vi } from 'vitest'
import type { EmptyStateWords } from '../emptyWords'
import { plainWordsFailures } from '../plainWords'
import {
  LIEN_CALENDAR_EMPTY,
  LIEN_CLEAR_THE_FIND,
  LIEN_RUN_EMPTY,
  LIEN_SHOW_EVERY_PILE,
  lienAffidavitsEmptyWords,
  lienBookEmptyWords,
  lienCalendarSearchEmptyWords,
  lienListFindEmptyWords,
  lienOwnerRecordsEmptyWords,
  lienOwnerRecordsSearchEmptyWords,
  lienPileEmptyWords,
} from './lienDeskEmptyWords'

/** The sentence as `EmptyState` draws it: the words, the press, the words after it. */
const read = (w: EmptyStateWords) => [w.main, w.next?.label, w.tail].filter(Boolean).join(' ')
const press = (w: EmptyStateWords) => {
  if (!w.next || !('onPress' in w.next)) throw new Error('no press')
  w.next.onPress()
}

describe('lienDeskEmptyWords (punch list #184, sweep C)', () => {
  it('an empty affidavit or retainage pile offers the notice list’s own press', () => {
    const show = vi.fn()
    const words = lienPileEmptyWords(show)
    expect(read(words)).toBe('Nothing in this pile. Show every pile ›')
    expect(words.next?.label).toBe(LIEN_SHOW_EVERY_PILE)
    press(words)
    expect(show).toHaveBeenCalledTimes(1)
  })

  it('a find that empties the affidavit or retainage list reads as the notice list’s find, with the box’s own clear', () => {
    const clear = vi.fn()
    const words = lienListFindEmptyWords(' Loberg ', clear)
    expect(read(words)).toBe('Nothing matches “Loberg”. Clear the find')
    expect(words.next?.label).toBe(LIEN_CLEAR_THE_FIND)
    press(words)
    expect(clear).toHaveBeenCalledTimes(1)
  })

  it('the affidavit list with nothing close sends the reader to Deadlines', () => {
    const open = vi.fn()
    const words = lienAffidavitsEmptyWords(open)
    expect(read(words)).toBe('No affidavit window closes within 30 days. Deadlines › shows what falls due later.')
    press(words)
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('the Deadlines board: the good state alone, a search that hides every job quotes it and clears it', () => {
    expect(LIEN_CALENDAR_EMPTY).toEqual({ main: 'Nothing billed is on a lien clock.' })
    const clear = vi.fn()
    const words = lienCalendarSearchEmptyWords('  Ridgeway ', clear)
    expect(read(words)).toBe('No billed jobs match ‘Ridgeway’. Clear the search')
    press(words)
    expect(clear).toHaveBeenCalledTimes(1)
  })

  it('the Timeline book offers All on Something due, and is the good state on All', () => {
    const all = vi.fn()
    const due = lienBookEmptyWords('due', all)
    expect(read(due)).toBe('Nothing is due inside 30 days on these jobs. Show All › lists the whole book.')
    press(due)
    expect(all).toHaveBeenCalledTimes(1)
    expect(lienBookEmptyWords('all', all)).toEqual({ main: 'No job has money open and a lien month.' })
  })

  it('the run and Records for an owner', () => {
    expect(LIEN_RUN_EMPTY).toEqual({ main: 'Nothing approved is waiting.' })
    const back = vi.fn()
    const none = lienOwnerRecordsEmptyWords(back)
    expect(read(none)).toBe('No job on the desk has a notice yet, so there is no owner to pick. Back to the desk ›')
    press(none)
    expect(back).toHaveBeenCalledTimes(1)
    const clear = vi.fn()
    const miss = lienOwnerRecordsSearchEmptyWords('terrell', clear)
    expect(read(miss)).toBe('No owners match ‘terrell’. Clear the search')
    press(miss)
    expect(clear).toHaveBeenCalledTimes(1)
  })

  it('every sentence follows plain words', () => {
    const noop = () => {}
    const all = [
      lienPileEmptyWords(noop),
      lienListFindEmptyWords('Loberg', noop),
      lienAffidavitsEmptyWords(noop),
      LIEN_CALENDAR_EMPTY,
      lienCalendarSearchEmptyWords('Ridgeway', noop),
      lienBookEmptyWords('due', noop),
      lienBookEmptyWords('all', noop),
      LIEN_RUN_EMPTY,
      lienOwnerRecordsEmptyWords(noop),
      lienOwnerRecordsSearchEmptyWords('terrell', noop),
    ]
    for (const w of all) expect(plainWordsFailures(read(w)), read(w)).toEqual([])
  })
})
