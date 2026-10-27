import { describe, expect, it, vi } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { duplicatePartsEmptyWords } from './duplicatePartsEmptyWords'

describe('duplicatePartsEmptyWords', () => {
  it('exact names only: Show near-matches looks further; with near-matches on, nothing to merge', () => {
    const show = vi.fn()
    const exact = duplicatePartsEmptyWords(false, show)
    expect(exact.next?.label).toBe('Show near-matches')
    if (exact.next && 'onPress' in exact.next) exact.next.onPress()
    expect(show).toHaveBeenCalledTimes(1)
    expect(duplicatePartsEmptyWords(true, show)).toEqual({ main: 'Nothing to merge.', tail: 'No two parts share a name or a near spelling.' })
  })

  it('both read in plain words', () => {
    for (const w of [duplicatePartsEmptyWords(false, () => {}), duplicatePartsEmptyWords(true, () => {})]) {
      const text = [w.main, w.next?.label, w.tail].filter(Boolean).join(' ')
      expect(plainWordsFailures(text), text).toEqual([])
    }
  })
})
