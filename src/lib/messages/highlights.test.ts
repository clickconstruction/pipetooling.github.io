import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { HIGHLIGHT_TIP, HIGHLIGHTED_TOAST, highlightedByWords, highlightsRemovedToast, removeHighlightsLabel, wholeWords } from './highlights'

const BODY = 'Is the detention pond in sitework or concrete? The civil sheets show it both ways.'

describe('highlights (cut 2, C3)', () => {
  it('grows a selection to whole words, and keeps words it cannot find as selected', () => {
    expect(wholeWords(BODY, 'tention po')).toBe('detention pond')
    expect(wholeWords(BODY, ' sitework ')).toBe('sitework')
    expect(wholeWords(BODY, 'ways')).toBe('ways.')
    expect(wholeWords(BODY, 'not in it')).toBe('not in it')
    expect(wholeWords(BODY, '   ')).toBe('')
  })

  it('says one highlight or many, and who made one when', () => {
    expect([removeHighlightsLabel(1), removeHighlightsLabel(3)]).toEqual(['Remove the highlight', 'Remove the highlights'])
    expect([highlightsRemovedToast(1), highlightsRemovedToast(2)]).toEqual(['Highlight removed.', '2 highlights removed.'])
    expect(highlightedByWords('Rosa', '2026-10-02T19:30:00.000Z', '2026-10-02T21:00:00.000Z')).toMatch(/^highlighted by Rosa · today at /)
  })

  it('keeps its words plain', () => {
    for (const w of [HIGHLIGHT_TIP, HIGHLIGHTED_TOAST, highlightsRemovedToast(2)]) expect(plainWordsFailures(w)).toEqual([])
  })
})
