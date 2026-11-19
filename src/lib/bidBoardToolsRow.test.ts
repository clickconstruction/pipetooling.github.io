import { describe, expect, it } from 'vitest'
import {
  BID_BOARD_SEARCH_FLOOR,
  BID_BOARD_TOOLS_HEIGHT,
  BID_BOARD_WORDS_ROW,
  BID_BOARD_WORDS_ROW_WITH_ASK,
  bidBoardSearchPlaceholder,
  bidBoardToolsAskStyle,
  bidBoardToolsFilterStyle,
  bidBoardToolsGroupStyle,
  bidBoardToolsMarkedStyle,
  bidBoardToolsPressStyle,
  bidBoardToolsRowLayout,
  bidBoardToolsRowStyle,
  bidBoardToolsSearchStyle,
} from './bidBoardToolsRow'

/** The row's width at each window measured on 2026-11-19: the window less the page's padding. */
const ROW = { w1440: 1328, w1280: 1168, w1024: 912, w768: 704 }

describe('bidBoardToolsRowLayout', () => {
  it('a phone draws the three book presses as icons and Marked as its circle, whatever the row measures', () => {
    expect(bidBoardToolsRowLayout({ phone: true, rowWidth: 343, askOpen: false })).toEqual({ words: false, markedCompact: true })
    expect(bidBoardToolsRowLayout({ phone: true, rowWidth: null, askOpen: true })).toEqual({ words: false, markedCompact: true })
  })

  it('at 1280 px the words stay with no ask open: the search keeps over 320 px beside them', () => {
    expect(bidBoardToolsRowLayout({ phone: false, rowWidth: ROW.w1280, askOpen: false })).toEqual({ words: true, markedCompact: false })
  })

  it('at 1280 px with an ask open the words fold, where the search was 139 px beside six worded presses', () => {
    expect(bidBoardToolsRowLayout({ phone: false, rowWidth: ROW.w1280, askOpen: true }).words).toBe(false)
    // A wider window has the room for the ask and the words.
    expect(bidBoardToolsRowLayout({ phone: false, rowWidth: ROW.w1440, askOpen: true }).words).toBe(true)
  })

  it('at 1024 and 768 px the words fold for everyone, where the search was 101 and 18 px', () => {
    for (const rowWidth of [ROW.w1024, ROW.w768]) {
      expect(bidBoardToolsRowLayout({ phone: false, rowWidth, askOpen: false }).words).toBe(false)
      expect(bidBoardToolsRowLayout({ phone: false, rowWidth, askOpen: true }).words).toBe(false)
    }
  })

  it('folds exactly under the width that leaves the search its 320 px, and an open ask asks for more', () => {
    expect(bidBoardToolsRowLayout({ phone: false, rowWidth: BID_BOARD_WORDS_ROW, askOpen: false }).words).toBe(true)
    expect(bidBoardToolsRowLayout({ phone: false, rowWidth: BID_BOARD_WORDS_ROW - 1, askOpen: false }).words).toBe(false)
    expect(bidBoardToolsRowLayout({ phone: false, rowWidth: BID_BOARD_WORDS_ROW_WITH_ASK, askOpen: true }).words).toBe(true)
    expect(bidBoardToolsRowLayout({ phone: false, rowWidth: BID_BOARD_WORDS_ROW_WITH_ASK - 1, askOpen: true }).words).toBe(false)
    expect(BID_BOARD_WORDS_ROW_WITH_ASK).toBeGreaterThan(BID_BOARD_WORDS_ROW)
  })

  it('before the row is measured a desk draws its words, as it always has', () => {
    expect(bidBoardToolsRowLayout({ phone: false, rowWidth: null, askOpen: true })).toEqual({ words: true, markedCompact: false })
  })
})

describe('the row never spills', () => {
  it('wraps at every width, and a line without the search keeps its presses to the right', () => {
    const row = bidBoardToolsRowStyle()
    expect(row.flexWrap).toBe('wrap')
    expect(row.justifyContent).toBe('flex-end')
    expect(row.alignItems).toBe('center')
  })

  it('the search takes a phone’s first line whole, and on a desk never goes under its floor on a shared line', () => {
    expect(bidBoardToolsSearchStyle(true).flex).toBe('1 1 100%')
    // A basis, where `1 1 auto` let six presses crush the search to its 18 px of border and padding.
    expect(bidBoardToolsSearchStyle(false).flex).toBe(`1 1 ${BID_BOARD_SEARCH_FLOOR}px`)
    expect(bidBoardToolsSearchStyle(false).minWidth).toBe(0)
  })

  it('the filter keeps the left of a wrapped line, capped at 7.5rem on a phone', () => {
    expect(bidBoardToolsFilterStyle(true).marginRight).toBe('auto')
    expect(bidBoardToolsFilterStyle(true).maxWidth).toBe('7.5rem')
    expect(bidBoardToolsFilterStyle(false).maxWidth).toBe('13rem')
    expect(bidBoardToolsFilterStyle(false).flexShrink).toBe(0)
  })

  it('a group wider than its line shrinks to the line and wraps its presses (v2.7912), at every width now', () => {
    const group = bidBoardToolsGroupStyle()
    expect(group.flexWrap).toBe('wrap')
    expect(group.flex).toBe('0 1 auto')
    expect(group.minWidth).toBe(0)
    expect(group.justifyContent).toBe('flex-end')
    expect(group.gap).toBe('0.5rem')
  })
})

describe('one height', () => {
  it('the search, a worded press, an icon press, the ask and Marked are all the search’s 36 px', () => {
    expect(BID_BOARD_TOOLS_HEIGHT).toBe(36)
    const heights = [
      bidBoardToolsSearchStyle(true).height,
      bidBoardToolsSearchStyle(false).height,
      bidBoardToolsPressStyle(true).height,
      bidBoardToolsPressStyle(false).height,
      bidBoardToolsAskStyle(true).height,
      bidBoardToolsAskStyle(false).height,
      bidBoardToolsMarkedStyle(true).height,
      bidBoardToolsMarkedStyle(false).height,
    ]
    expect(new Set(heights)).toEqual(new Set([36]))
  })

  it('no press pads itself top or bottom: the padding is what drew the 42 and 34 px lines', () => {
    for (const style of [bidBoardToolsPressStyle(false), bidBoardToolsAskStyle(true), bidBoardToolsAskStyle(false), bidBoardToolsMarkedStyle(true), bidBoardToolsMarkedStyle(false)]) {
      expect(String(style.padding)).toMatch(/^0 /)
      expect(style.boxSizing ?? 'border-box').toBe('border-box')
    }
    expect(bidBoardToolsPressStyle(true).padding).toBe(0)
  })

  it('an icon press is a 36 px square, and Marked as its circle is at least one', () => {
    expect(bidBoardToolsPressStyle(true).width).toBe(36)
    expect(bidBoardToolsPressStyle(false).width).toBeUndefined()
    // At least: its count rides beside the circle and may widen it.
    expect(bidBoardToolsMarkedStyle(true).minWidth).toBe(36)
    expect(bidBoardToolsMarkedStyle(false).minWidth).toBeUndefined()
  })

  it('the ask reads in the row’s own 14 px type and takes the page’s family alone', () => {
    const ask = bidBoardToolsAskStyle(false)
    expect(ask.fontSize).toBe('0.875rem')
    expect(ask.fontWeight).toBe(600)
    expect(ask.fontFamily).toBe('inherit')
    expect('font' in ask).toBe(false)
    expect(ask.whiteSpace).toBe('nowrap')
  })
})

describe('bidBoardSearchPlaceholder', () => {
  it('names what the box finds on both widths, no bare "Search..." on the phone', () => {
    expect(bidBoardSearchPlaceholder(true)).toBe('Search project, GC or bid number…')
    expect(bidBoardSearchPlaceholder(false)).toMatch(/^Search \(project name, GC\/Builder, bid number or address\)/)
  })
})
