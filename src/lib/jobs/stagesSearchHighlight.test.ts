import { describe, expect, it } from 'vitest'
import { splitTextByMatch, textHasMatch } from './stagesSearchHighlight'

describe('splitTextByMatch', () => {
  it('marks a case-insensitive hit mid-string', () => {
    expect(splitTextByMatch('1132 Miraloma Lane', 'mira')).toEqual([
      { text: '1132 ', match: false },
      { text: 'Mira', match: true },
      { text: 'loma Lane', match: false },
    ])
  })

  it('marks every occurrence', () => {
    expect(splitTextByMatch('abcabc', 'b')).toEqual([
      { text: 'a', match: false },
      { text: 'b', match: true },
      { text: 'ca', match: false },
      { text: 'b', match: true },
      { text: 'c', match: false },
    ])
  })

  it('whole-string and prefix hits', () => {
    expect(splitTextByMatch('561', '561')).toEqual([{ text: '561', match: true }])
    expect(splitTextByMatch('5610', '561')).toEqual([
      { text: '561', match: true },
      { text: '0', match: false },
    ])
  })

  it('no query / no hit / blank text → single plain segment', () => {
    expect(splitTextByMatch('hello', '')).toEqual([{ text: 'hello', match: false }])
    expect(splitTextByMatch('hello', null)).toEqual([{ text: 'hello', match: false }])
    expect(splitTextByMatch('hello', 'zz')).toEqual([{ text: 'hello', match: false }])
    expect(splitTextByMatch('', 'zz')).toEqual([{ text: '', match: false }])
  })

  it('trims the query like the board filter does', () => {
    expect(splitTextByMatch('Tovi Pinpoint', '  tovi ')).toEqual([
      { text: 'Tovi', match: true },
      { text: ' Pinpoint', match: false },
    ])
  })
})

describe('textHasMatch', () => {
  it('mirrors the split verdict', () => {
    expect(textHasMatch('Frantzen Water Heater', 'FRAN')).toBe(true)
    expect(textHasMatch('Frantzen', 'zz')).toBe(false)
    expect(textHasMatch(null, 'a')).toBe(false)
    expect(textHasMatch('abc', '  ')).toBe(false)
  })
})
