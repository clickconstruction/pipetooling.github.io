import { describe, expect, it } from 'vitest'
import { splitTextForQueryHighlight } from './assignJobPickerHighlight'

describe('splitTextForQueryHighlight', () => {
  it('returns the whole text unmatched when the query is empty or blank', () => {
    expect(splitTextForQueryHighlight('926 · Estimate', '')).toEqual([{ text: '926 · Estimate', match: false }])
    expect(splitTextForQueryHighlight('926 · Estimate', '   ')).toEqual([{ text: '926 · Estimate', match: false }])
  })

  it('returns empty for empty text', () => {
    expect(splitTextForQueryHighlight('', 'x')).toEqual([])
  })

  it('marks a single case-insensitive occurrence', () => {
    expect(splitTextForQueryHighlight('Take 5- Liberty Hill', 'liberty')).toEqual([
      { text: 'Take 5- ', match: false },
      { text: 'Liberty', match: true },
      { text: ' Hill', match: false },
    ])
  })

  it('marks every occurrence', () => {
    expect(splitTextForQueryHighlight('ababa', 'ab')).toEqual([
      { text: 'ab', match: true },
      { text: 'ab', match: true },
      { text: 'a', match: false },
    ])
  })

  it('marks a full-string match as one segment', () => {
    expect(splitTextForQueryHighlight('926', '926')).toEqual([{ text: '926', match: true }])
  })

  it('handles digits inside larger labels (number mode)', () => {
    expect(splitTextForQueryHighlight('926 · Estimate for Dylan Beck', '92')).toEqual([
      { text: '92', match: true },
      { text: '6 · Estimate for Dylan Beck', match: false },
    ])
  })
})
