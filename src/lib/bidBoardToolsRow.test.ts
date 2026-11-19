import { describe, expect, it } from 'vitest'
import { bidBoardSearchPlaceholder, bidBoardToolsGroupStyle, bidBoardToolsRowLayout } from './bidBoardToolsRow'

describe('bidBoardToolsRowLayout', () => {
  it('on a phone the search takes the first line whole and the press group keeps the right of its own line', () => {
    expect(bidBoardToolsRowLayout(true)).toEqual({
      rowWrap: 'wrap',
      searchFlex: '1 1 100%',
      groupMarginLeft: 'auto',
      groupFlex: '0 1 auto',
      groupWrap: 'wrap',
      groupJustify: 'flex-end',
    })
  })

  it('over 660 px the row draws as before: one line, the search shrinking', () => {
    expect(bidBoardToolsRowLayout(false)).toEqual({
      rowWrap: 'nowrap',
      searchFlex: '1 1 auto',
      groupMarginLeft: undefined,
      groupFlex: '0 0 auto',
      groupWrap: 'nowrap',
      groupJustify: undefined,
    })
  })
})

describe('bidBoardToolsGroupStyle', () => {
  it('on a phone the group may shrink to its line and wrap its presses, kept to the right (v2.7912)', () => {
    // With the ask to rate a GC open the six presses measured 462 px in a 343 px column at 375 px,
    // and the page scrolled sideways to 478. Each of the three is needed for the group to wrap.
    const style = bidBoardToolsGroupStyle(true)
    expect(style.flexWrap).toBe('wrap')
    expect(style.flex).toBe('0 1 auto')
    expect(style.minWidth).toBe(0)
    expect(style.justifyContent).toBe('flex-end')
    expect(style.marginLeft).toBe('auto')
  })

  it('on a desk the group never shrinks or wraps: the search is what gives way', () => {
    const style = bidBoardToolsGroupStyle(false)
    expect(style.flexWrap).toBe('nowrap')
    expect(style.flex).toBe('0 0 auto')
    expect(style.justifyContent).toBeUndefined()
    expect(style.marginLeft).toBeUndefined()
  })

  it('keeps the gap between presses on both widths', () => {
    expect(bidBoardToolsGroupStyle(true).gap).toBe('0.5rem')
    expect(bidBoardToolsGroupStyle(false).gap).toBe('0.5rem')
    expect(bidBoardToolsGroupStyle(false).display).toBe('flex')
  })
})

describe('bidBoardSearchPlaceholder', () => {
  it('names what the box finds on both widths, no bare "Search..." on the phone', () => {
    expect(bidBoardSearchPlaceholder(true)).toBe('Search project, GC or bid number…')
    expect(bidBoardSearchPlaceholder(false)).toMatch(/^Search \(project name, GC\/Builder, bid number or address\)/)
  })
})
