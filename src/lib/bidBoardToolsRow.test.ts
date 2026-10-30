import { describe, expect, it } from 'vitest'
import { bidBoardSearchPlaceholder, bidBoardToolsRowLayout } from './bidBoardToolsRow'

describe('bidBoardToolsRowLayout', () => {
  it('on a phone the search takes the first line whole and the press group keeps the right of its own line', () => {
    expect(bidBoardToolsRowLayout(true)).toEqual({
      rowWrap: 'wrap',
      searchFlex: '1 1 100%',
      groupMarginLeft: 'auto',
    })
  })

  it('over 660 px the row draws as before: one line, the search shrinking', () => {
    expect(bidBoardToolsRowLayout(false)).toEqual({
      rowWrap: 'nowrap',
      searchFlex: '1 1 auto',
      groupMarginLeft: undefined,
    })
  })
})

describe('bidBoardSearchPlaceholder', () => {
  it('names what the box finds on both widths, no bare "Search..." on the phone', () => {
    expect(bidBoardSearchPlaceholder(true)).toBe('Search project, GC or bid number…')
    expect(bidBoardSearchPlaceholder(false)).toMatch(/^Search \(project name, GC\/Builder, bid number or address\)/)
  })
})
